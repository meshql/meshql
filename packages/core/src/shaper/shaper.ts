import type { ASTNode } from "../parser/ast.js";
import type { ResolvedJoin } from "../planner/join-plan.js";

const ROW_KEY_SEPARATORS = ["_", "."];

function readField(
  row: Record<string, unknown>,
  nodeName: string,
  field: string,
): unknown {
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
): boolean {
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

function projectFields(
  row: Record<string, unknown>,
  nodeName: string,
  fields: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    result[field] = readField(row, nodeName, field);
  }
  return result;
}

function shapeRefMany(
  rows: Record<string, unknown>[],
  ref: ASTNode,
  join: ResolvedJoin,
): Record<string, unknown>[] {
  // The id column may or may not be in the row. If it is, we use it to dedupe
  // Cartesian-product duplicates and to detect left-join no-match rows
  // (id === null). If it's not, we degrade to "accept every row as unique" —
  // resolvers that don't return the id column lose dedup but stay functional.
  if (hasField(rows, ref.name, join.idField)) {
    const seen = new Map<unknown, Record<string, unknown>>();
    for (const row of rows) {
      const idValue = readField(row, ref.name, join.idField);
      if (idValue === null || idValue === undefined) {
        continue;
      }
      if (seen.has(idValue)) {
        continue;
      }
      seen.set(idValue, projectFields(row, ref.name, ref.fields));
    }
    return [...seen.values()];
  }

  return rows.map((row) => projectFields(row, ref.name, ref.fields));
}

function shapeRefOne(
  rows: Record<string, unknown>[],
  ref: ASTNode,
  join: ResolvedJoin,
): Record<string, unknown> | null {
  const idColumnPresent = hasField(rows, ref.name, join.idField);

  for (const row of rows) {
    if (idColumnPresent) {
      const idValue = readField(row, ref.name, join.idField);
      if (idValue === null || idValue === undefined) {
        continue;
      }
    }
    return projectFields(row, ref.name, ref.fields);
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

  const joinByRef = new Map(joins.map((j) => [j.refName, j]));

  for (const ref of node.refs) {
    const join = joinByRef.get(ref.name);
    if (!join) {
      // No corresponding join in the plan — treat as a flat field group on the
      // root rows, no dedup, no left-join handling.
      result[ref.name] = rows.map((row) => projectFields(row, ref.name, ref.fields));
      continue;
    }

    result[ref.name] =
      join.type === "many"
        ? shapeRefMany(rows, ref, join)
        : shapeRefOne(rows, ref, join);
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
    // No way to group safely — fall back to treating each row as a separate
    // record. This matches pre-0.2 behaviour for resolvers that don't return
    // the id column.
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
