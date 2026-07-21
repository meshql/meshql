import type { MeshSchema } from "../schema/schema.js";
import type { WhereExpr } from "./types.js";

export type SqlDialect = "postgres" | "sqlite";

const OP_SQL: Record<string, string> = {
  eq: "=",
  ne: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
  ilike: "ILIKE",
};

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

/** Render a boolean where expression into SQL with bound parameters. */
export function renderWhereSql(
  expr: WhereExpr,
  tableRef: string,
  entityKey: string,
  schema: MeshSchema,
  params: unknown[],
  dialect: SqlDialect,
): string {
  if ("and" in expr) {
    const parts = expr.and.map((child) =>
      renderWhereSql(child, tableRef, entityKey, schema, params, dialect),
    );
    return `(${parts.join(" AND ")})`;
  }
  if ("or" in expr) {
    const parts = expr.or.map((child) =>
      renderWhereSql(child, tableRef, entityKey, schema, params, dialect),
    );
    return `(${parts.join(" OR ")})`;
  }
  if ("not" in expr) {
    return `(NOT ${renderWhereSql(expr.not, tableRef, entityKey, schema, params, dialect)})`;
  }

  const col = columnRef(tableRef, entityKey, expr.field, schema);
  if (expr.op === "isNull") return `${col} IS NULL`;
  if (expr.op === "isNotNull") return `${col} IS NOT NULL`;

  if (expr.op === "in" || expr.op === "nin") {
    if (!Array.isArray(expr.value)) {
      throw new Error(`Filter '${expr.field} ${expr.op}' requires an array value`);
    }
    if (dialect === "postgres") {
      params.push(expr.value);
      const op = expr.op === "in" ? "= ANY" : "<> ALL";
      return `${col} ${op}($${params.length})`;
    }
    const placeholders = expr.value.map((value) => {
      params.push(value);
      return `?`;
    });
    const op = expr.op === "in" ? "IN" : "NOT IN";
    return `${col} ${op} (${placeholders.join(", ")})`;
  }

  const op = OP_SQL[expr.op];
  if (!op) throw new Error(`Unsupported operator '${expr.op}'`);
  const ilike = expr.op === "ilike" && dialect === "sqlite" ? "LIKE" : op;
  params.push(expr.value);
  const placeholder = dialect === "postgres" ? `$${params.length}` : "?";
  return `${col} ${ilike} ${placeholder}`;
}
