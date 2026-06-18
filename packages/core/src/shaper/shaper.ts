import type { ASTNode } from "../parser/ast.js";
import type { ResolvedJoin } from "../planner/join-plan.js";

function readField(
  row: Record<string, unknown>,
  nodeName: string,
  field: string,
): unknown {
  return row[`${nodeName}_${field}`] ?? row[field] ?? row[`${nodeName}.${field}`];
}

/** Shape flat SQL rows into nested JSON for a single root record. */
export function shape(
  rows: Record<string, unknown>[],
  node: ASTNode,
  joins: ResolvedJoin[] = [],
): Record<string, unknown> | Record<string, unknown>[] {
  if (rows.length === 0) {
    return {};
  }

  const joinByRef = new Map(joins.map((j) => [j.refName, j]));

  const row = rows[0]!;
  const result: Record<string, unknown> = {};

  for (const field of node.fields) {
    result[field] = readField(row, node.name, field);
  }

  for (const ref of node.refs) {
    const join = joinByRef.get(ref.name);
    const refRows = rows.map((r) => {
      const refRow: Record<string, unknown> = {};
      for (const f of ref.fields) {
        refRow[f] = readField(r, ref.name, f);
      }
      return refRow;
    });

    const isMany = join?.type === "many" || ref.name.endsWith("s");
    result[ref.name] = isMany ? refRows : (refRows[0] ?? null);
  }

  return result;
}

/** Shape flat SQL rows into nested JSON for a list of root records. */
export function shapeMany(
  rows: Record<string, unknown>[],
  node: ASTNode,
  joins: ResolvedJoin[] = [],
): Record<string, unknown>[] {
  if (rows.length === 0) {
    return [];
  }

  const rootIds = new Set<unknown>();
  const idField = node.fields.includes("id") ? "id" : node.fields[0];

  for (const row of rows) {
    if (idField) {
      rootIds.add(readField(row, node.name, idField));
    }
  }

  if (rootIds.size === 0) {
    return [shape(rows, node, joins) as Record<string, unknown>];
  }

  return [...rootIds].map((id) => {
    const groupRows = rows.filter(
      (r) => !idField || readField(r, node.name, idField) === id,
    );
    return shape(groupRows, node, joins) as Record<string, unknown>;
  });
}
