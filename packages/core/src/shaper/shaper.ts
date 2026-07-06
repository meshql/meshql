import type { ASTNode } from "../parser/ast.js";
import {
  joinPathAlias,
  type ResolvedJoin,
} from "../planner/join-plan.js";

const ROW_KEY_SEPARATORS = ["_", "."];

function joinForPath(path: string, joins: ResolvedJoin[]): ResolvedJoin | undefined {
  return joins.find((join) => join.path === path);
}

function readField(
  row: Record<string, unknown>,
  nodeName: string,
  field: string,
  parentJoinPath?: string,
): unknown {
  if (parentJoinPath) {
    const pathAlias = `${joinPathAlias(parentJoinPath)}_${nodeName}_${field}`;
    if (pathAlias in row) {
      return row[pathAlias];
    }
    const nestedPath = `${parentJoinPath}.${nodeName}`;
    const nestedAlias = `${joinPathAlias(nestedPath)}_${field}`;
    if (nestedAlias in row) {
      return row[nestedAlias];
    }
  }

  for (const sep of ROW_KEY_SEPARATORS) {
    const qualified = `${nodeName}${sep}${field}`;
    if (qualified in row) {
      return row[qualified];
    }
  }
  if (field in row) {
    return row[field];
  }
  return undefined;
}

function hasField(
  rows: Record<string, unknown>[],
  nodeName: string,
  field: string,
  parentJoinPath?: string,
): boolean {
  if (parentJoinPath) {
    const pathAlias = `${joinPathAlias(parentJoinPath)}_${nodeName}_${field}`;
    for (const row of rows) {
      if (pathAlias in row) {
        return true;
      }
    }
    const nestedPath = `${parentJoinPath}.${nodeName}`;
    const nestedAlias = `${joinPathAlias(nestedPath)}_${field}`;
    for (const row of rows) {
      if (nestedAlias in row) {
        return true;
      }
    }
  }

  for (const sep of ROW_KEY_SEPARATORS) {
    const qualified = `${nodeName}${sep}${field}`;
    for (const row of rows) {
      if (qualified in row) {
        return true;
      }
    }
  }
  for (const row of rows) {
    if (field in row) {
      return true;
    }
  }
  return false;
}

function shapeRefRecord(
  rows: Record<string, unknown>[],
  ref: ASTNode,
  join: ResolvedJoin,
  joins: ResolvedJoin[],
  parentJoinPath: string,
): Record<string, unknown> {
  const firstRow = rows[0]!;
  const result: Record<string, unknown> = {};
  const currentPath = parentJoinPath ? `${parentJoinPath}.${ref.name}` : ref.name;

  for (const field of ref.fields) {
    result[field] = readField(firstRow, ref.name, field, parentJoinPath);
  }

  for (const childRef of ref.refs) {
    const childPath = `${currentPath}.${childRef.name}`;
    const childJoin = joinForPath(childPath, joins);
    if (!childJoin) {
      result[childRef.name] = rows.map((row) => {
        const nested: Record<string, unknown> = {};
        for (const field of childRef.fields) {
          nested[field] = readField(row, childRef.name, field, currentPath);
        }
        return nested;
      });
      continue;
    }

    result[childRef.name] =
      childJoin.type === "many"
        ? shapeRefMany(rows, childRef, childJoin, joins, currentPath)
        : shapeRefOne(rows, childRef, childJoin, joins, currentPath);
  }

  return result;
}

function shapeRefMany(
  rows: Record<string, unknown>[],
  ref: ASTNode,
  join: ResolvedJoin,
  joins: ResolvedJoin[],
  parentJoinPath: string,
): Record<string, unknown>[] {
  if (hasField(rows, ref.name, join.idField, parentJoinPath)) {
    const seen = new Map<unknown, Record<string, unknown>>();
    for (const row of rows) {
      const idValue = readField(row, ref.name, join.idField, parentJoinPath);
      if (idValue === null || idValue === undefined) {
        continue;
      }
      if (seen.has(idValue)) {
        continue;
      }
      const childRows = rows.filter(
        (candidate) =>
          readField(candidate, ref.name, join.idField, parentJoinPath) === idValue,
      );
      seen.set(idValue, shapeRefRecord(childRows, ref, join, joins, parentJoinPath));
    }
    return [...seen.values()];
  }

  return rows.map((row) => shapeRefRecord([row], ref, join, joins, parentJoinPath));
}

function shapeRefOne(
  rows: Record<string, unknown>[],
  ref: ASTNode,
  join: ResolvedJoin,
  joins: ResolvedJoin[],
  parentJoinPath: string,
): Record<string, unknown> | null {
  const idColumnPresent = hasField(rows, ref.name, join.idField, parentJoinPath);

  for (const row of rows) {
    if (idColumnPresent) {
      const idValue = readField(row, ref.name, join.idField, parentJoinPath);
      if (idValue === null || idValue === undefined) {
        continue;
      }
    }
    return shapeRefRecord([row], ref, join, joins, parentJoinPath);
  }

  return null;
}

function shapeRecord(
  rows: Record<string, unknown>[],
  node: ASTNode,
  joins: ResolvedJoin[],
): Record<string, unknown> {
  const firstRow = rows[0]!;
  const result: Record<string, unknown> = {};

  for (const field of node.fields) {
    result[field] = readField(firstRow, node.name, field);
  }

  for (const ref of node.refs) {
    const join = joinForPath(ref.name, joins);
    if (!join) {
      result[ref.name] = rows.map((row) => {
        const nested: Record<string, unknown> = {};
        for (const field of ref.fields) {
          nested[field] = readField(row, ref.name, field);
        }
        return nested;
      });
      continue;
    }

    result[ref.name] =
      join.type === "many"
        ? shapeRefMany(rows, ref, join, joins, "")
        : shapeRefOne(rows, ref, join, joins, "");
  }

  return result;
}

/** Shape flat SQL rows into nested JSON for a single root record. */
export function shape(
  rows: Record<string, unknown>[],
  node: ASTNode,
  joins: ResolvedJoin[] = [],
): Record<string, unknown> {
  if (rows.length === 0) {
    return {};
  }
  return shapeRecord(rows, node, joins);
}

/**
 * Shape flat SQL rows into a list of nested JSON records.
 *
 * Rows are grouped by `rootIdField` (default `"id"`). Each group becomes one
 * record, with `many` joins deduped by their own id field and `one` joins
 * resolved to the first non-null match.
 */
export function shapeMany(
  rows: Record<string, unknown>[],
  node: ASTNode,
  joins: ResolvedJoin[] = [],
  rootIdField: string = "id",
): Record<string, unknown>[] {
  if (rows.length === 0) {
    return [];
  }

  if (!hasField(rows, node.name, rootIdField)) {
    return rows.map((row) => shapeRecord([row], node, joins));
  }

  const groups = new Map<unknown, Record<string, unknown>[]>();
  for (const row of rows) {
    const rootId = readField(row, node.name, rootIdField);
    if (rootId === null || rootId === undefined) {
      continue;
    }
    const bucket = groups.get(rootId);
    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(rootId, [row]);
    }
  }

  return [...groups.values()].map((groupRows) => shapeRecord(groupRows, node, joins));
}
