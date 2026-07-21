import type { ASTNode } from "../parser/ast.js";
import { joinPathAlias, type ResolvedJoin } from "../planner/join-plan.js";
import type { NormalizedReadNode } from "../query/types.js";

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

/**
 * Reader closure that caches the resolved row-alias key for a specific
 * (nodeName, field, parentJoinPath) tuple. Zero string allocations after
 * the first hit — pay the cost once, reuse across rows.
 *
 * Use in hot loops that read the same field across many rows (grouping,
 * dedup). For one-off single-row reads prefer {@link readField}, which
 * doesn't pay the upfront closure/keys-array allocation.
 */
type FieldReader = (row: Record<string, unknown>) => unknown;

function makeFieldReader(
  nodeName: string,
  field: string,
  parentJoinPath?: string,
): FieldReader {
  const keys: string[] = [];
  if (parentJoinPath) {
    keys.push(`${joinPathAlias(parentJoinPath)}_${nodeName}_${field}`);
    keys.push(`${joinPathAlias(`${parentJoinPath}.${nodeName}`)}_${field}`);
  }
  keys.push(`${nodeName}_${field}`);
  keys.push(`${nodeName}.${field}`);
  keys.push(field);

  let cachedKey: string | undefined;
  return (row) => {
    if (cachedKey !== undefined) {
      return row[cachedKey];
    }
    for (const k of keys) {
      if (k in row) {
        cachedKey = k;
        return row[k];
      }
    }
    return undefined;
  };
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
  if (!hasField(rows, ref.name, join.idField, parentJoinPath)) {
    return rows.map((row) => shapeRefRecord([row], ref, join, joins, parentJoinPath));
  }

  // Pre-group rows by id in a single O(N) pass. Preserves the previous
  // "first-seen id wins the output slot" ordering because JS Map iteration
  // is insertion-ordered.
  const readId = makeFieldReader(ref.name, join.idField, parentJoinPath);
  const groups = new Map<unknown, Record<string, unknown>[]>();
  for (const row of rows) {
    const idValue = readId(row);
    if (idValue === null || idValue === undefined) {
      continue;
    }
    const bucket = groups.get(idValue);
    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(idValue, [row]);
    }
  }

  return [...groups.values()].map((childRows) =>
    shapeRefRecord(childRows, ref, join, joins, parentJoinPath),
  );
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

/**
 * Project grouped aggregate rows into response objects.
 *
 * Aggregate SQL already returns one flat row per group (`groupBy` keys +
 * named aggregate aliases). The normal record shaper only projects `$select`
 * fields and would drop aliases like `total`.
 */
export function shapeAggregateRows(
  rows: Record<string, unknown>[],
  read: NormalizedReadNode,
): Record<string, unknown>[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const add = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };
  for (const field of read.groupBy ?? []) add(field);
  for (const alias of Object.keys(read.aggregates ?? {})) add(alias);
  for (const field of read.fields) add(field);

  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in row) {
        out[key] = row[key];
        continue;
      }
      const prefixed = `${read.name}_${key}`;
      if (prefixed in row) {
        out[key] = row[prefixed];
      }
    }
    return out;
  });
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

  const readRootId = makeFieldReader(node.name, rootIdField);
  const groups = new Map<unknown, Record<string, unknown>[]>();
  for (const row of rows) {
    const rootId = readRootId(row);
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
