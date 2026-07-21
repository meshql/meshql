import type { MeshSchema } from "../schema/schema.js";
import {
  assertCursorMatchesRead,
  decodeReadCursor,
  normalizeOrderForCursor,
} from "./read-cursor.js";
import type { NormalizedReadNode } from "./types.js";
import { renderWhereSql, type SqlDialect } from "./where-sql.js";

function columnRef(
  tableRef: string,
  entityKey: string,
  field: string,
  schema: MeshSchema,
): string {
  const config = schema.entities[entityKey];
  const column = config?.columns?.[field] ?? field;
  return `${tableRef}.${column}`;
}

/** Render a lexicographic keyset cursor predicate for normalized order keys. */
export function renderCursorPredicateSql(
  read: NormalizedReadNode,
  tableRef: string,
  schema: MeshSchema,
  params: unknown[],
  dialect: SqlDialect,
): string | undefined {
  const after = read.page?.after;
  if (!after) return undefined;

  const cursor = decodeReadCursor(after);
  assertCursorMatchesRead(cursor, read);
  const order = normalizeOrderForCursor(read.orderBy);
  if (order.length === 0) return undefined;

  const tupleCols = order.map((entry) =>
    columnRef(tableRef, read.entityKey, entry.field, schema),
  );

  const placeholders = cursor.values.map((value) => {
    params.push(value);
    return dialect === "postgres" ? `$${params.length}` : "?";
  });

  const tupleExpr =
    dialect === "postgres"
      ? `(${tupleCols.join(", ")})`
      : `(${tupleCols.join(", ")})`;

  const valueExpr =
    dialect === "postgres"
      ? `(${placeholders.join(", ")})`
      : `(${placeholders.join(", ")})`;

  const primary = order[0]!;
  const op = primary.direction === "desc" ? "<" : ">";
  return `${tupleExpr} ${op} ${valueExpr}`;
}

export function renderReadWhereSql(
  read: NormalizedReadNode | undefined,
  tableRef: string,
  entityKey: string,
  schema: MeshSchema,
  params: unknown[],
  dialect: SqlDialect,
): string[] {
  const clauses: string[] = [];
  if (read?.where) {
    clauses.push(renderWhereSql(read.where, tableRef, entityKey, schema, params, dialect));
  }
  const cursorClause = read ? renderCursorPredicateSql(read, tableRef, schema, params, dialect) : undefined;
  if (cursorClause) clauses.push(cursorClause);
  return clauses;
}
