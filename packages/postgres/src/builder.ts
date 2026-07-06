import type {
  Filter,
  JoinPlan,
  ListOptions,
  MeshSchema,
  OrderBy,
} from "@meshql/core";
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  buildPathToSqlAlias,
  entityTable,
  joinsInDependencyOrder,
  physicalTableForJoin,
  resolvePlanField,
  rewriteJoinOn,
  rowAliasForPlanField,
} from "@meshql/core";

/** Parameterized SQL query generated from a join plan. */
export interface SqlQuery {
  sql: string;
  params: unknown[];
}

/** Options for {@link buildSelectSql}. */
export interface SqlBuilderOptions {
  idColumn?: string;
}

/**
 * Opaque cursor payload. Callers should treat the string as an opaque token
 * and use {@link encodeCursor} / {@link decodeCursor} to round-trip through it.
 */
export interface CursorPayload {
  id: unknown;
}

/**
 * Encode a cursor payload as a URL-safe opaque string.
 *
 * The current scheme uses `base64url(JSON.stringify(payload))` and only
 * populates the `id` field — keyset pagination is stable on the
 * primary id ordering. Multi-column cursors are a post-v0.3 concern.
 */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Decode a cursor string produced by {@link encodeCursor}.
 *
 * Throws when the string is not valid base64url, not valid JSON, or does
 * not include an `id` field. Callers should treat any error as a 400
 * "malformed cursor" response.
 */
export function decodeCursor(raw: string): CursorPayload {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new Error("Invalid cursor: not valid base64url");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new Error("Invalid cursor: not valid JSON");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("id" in parsed)
  ) {
    throw new Error("Invalid cursor: missing 'id' field");
  }

  return parsed as CursorPayload;
}

const OP_SQL: Record<Filter["op"], string> = {
  eq: "=",
  ne: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
  ilike: "ILIKE",
  in: "= ANY",
  nin: "<> ALL",
};

function sqlColumn(entityKey: string, field: string, schema: MeshSchema): string {
  const config = schema.entities[entityKey];
  return config?.columns?.[field] ?? field;
}

/**
 * Render a single {@link Filter} into a SQL fragment and push its value(s)
 * into `params`. Uses Postgres `= ANY($n)` / `<> ALL($n)` for `in`/`nin`
 * so array values ride in a single parameter slot.
 */
function renderFilter(
  filter: Filter,
  rootTable: string,
  rootEntityKey: string,
  schema: MeshSchema,
  params: unknown[],
): string {
  const column = sqlColumn(rootEntityKey, filter.field, schema);
  const op = OP_SQL[filter.op];

  if (filter.op === "in" || filter.op === "nin") {
    if (!Array.isArray(filter.value)) {
      throw new Error(`Filter '${filter.field} ${filter.op}' requires an array value`);
    }
    params.push(filter.value);
    return `${rootTable}.${column} ${op}($${params.length})`;
  }

  params.push(filter.value);
  return `${rootTable}.${column} ${op} $${params.length}`;
}

function renderOrderBy(
  orderBy: OrderBy[],
  rootTable: string,
  rootEntityKey: string,
  schema: MeshSchema,
): string {
  return orderBy
    .map((entry) => {
      const column = sqlColumn(rootEntityKey, entry.field, schema);
      const dir = entry.dir === "desc" ? "DESC" : "ASC";
      return `${rootTable}.${column} ${dir}`;
    })
    .join(", ");
}

function effectiveLimit(list: ListOptions | undefined): number {
  const requested = list?.limit ?? DEFAULT_LIST_LIMIT;
  return Math.min(requested, MAX_LIST_LIMIT);
}

/** Build a parameterized SELECT statement from a join plan. */
export function buildSelectSql(
  plan: JoinPlan,
  schema: MeshSchema,
  options: SqlBuilderOptions = {},
): SqlQuery {
  const rootConfig = schema.entities[plan.rootEntity];
  if (!rootConfig) {
    throw new Error(`Unknown root entity '${plan.rootEntity}'`);
  }

  const rootTable = entityTable(plan.rootEntity, rootConfig);
  const idColumn = options.idColumn ?? "id";
  const params: unknown[] = [];
  const pathToAlias = buildPathToSqlAlias(plan);
  const selectParts: string[] = [];

  for (const qualified of plan.fields) {
    const { sqlTableRef, sqlColumn: column } = resolvePlanField(
      qualified,
      plan,
      schema,
      rootTable,
    );
    const alias = rowAliasForPlanField(qualified, plan);
    selectParts.push(`${sqlTableRef}.${column} AS "${alias}"`);
  }

  let sql = `SELECT ${selectParts.join(", ")} FROM ${rootTable}`;

  const joinedPaths = new Set<string>();

  for (const join of joinsInDependencyOrder(plan.joins)) {
    if (joinedPaths.has(join.path)) {
      continue;
    }

    joinedPaths.add(join.path);
    const sqlAlias = pathToAlias.get(join.path)!;
    const physicalTable = physicalTableForJoin(join, schema);
    const onClause = rewriteJoinOn(join.on, join, plan.joins, pathToAlias, schema);
    sql += ` LEFT JOIN ${physicalTable} AS ${sqlAlias} ON ${onClause}`;
  }

  const whereClauses: string[] = [];

  if (plan.context.entityId !== undefined) {
    params.push(plan.context.entityId);
    whereClauses.push(`${rootTable}.${idColumn} = $${params.length}`);
  } else if (plan.list) {
    if (plan.list.filter) {
      for (const filter of plan.list.filter) {
        whereClauses.push(
          renderFilter(filter, rootTable, plan.rootEntity, schema, params),
        );
      }
    }

    if (plan.list.cursor) {
      const cursor = decodeCursor(plan.list.cursor);
      params.push(cursor.id);
      whereClauses.push(`${rootTable}.${idColumn} > $${params.length}`);
    }
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(" AND ")}`;
  }

  if (plan.list?.orderBy && plan.list.orderBy.length > 0) {
    sql += ` ORDER BY ${renderOrderBy(plan.list.orderBy, rootTable, plan.rootEntity, schema)}`;
  } else if (plan.list && plan.context.entityId === undefined) {
    sql += ` ORDER BY ${rootTable}.${idColumn} ASC`;
  }

  if (plan.list && plan.context.entityId === undefined) {
    const limit = effectiveLimit(plan.list);
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }

  return { sql, params };
}
