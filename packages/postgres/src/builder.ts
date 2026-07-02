import type {
  Filter,
  JoinPlan,
  ListOptions,
  MeshSchema,
  OrderBy,
  ResolvedJoin,
} from "@meshql/core";
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  entityTable,
  resolveEntityKey,
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

function parseQualifiedField(qualified: string): { table: string; column: string } {
  const dot = qualified.lastIndexOf(".");
  if (dot === -1) {
    return { table: "", column: qualified };
  }
  return {
    table: qualified.slice(0, dot),
    column: qualified.slice(dot + 1),
  };
}

function joinForTable(
  table: string,
  joins: ResolvedJoin[],
  schema: MeshSchema,
  rootEntity: string,
): ResolvedJoin | undefined {
  return joins.find((join) => {
    const joinConfig = schema.joins[`${rootEntity}.${join.refName}`];
    const joinTable =
      joinConfig?.table ?? entityTable(join.entity, schema.entities[join.entity]);
    return table === joinTable || table === join.refName || table === join.entity;
  });
}

function aliasForField(
  plan: JoinPlan,
  schema: MeshSchema,
  rootTable: string,
  qualified: string,
): string {
  const { table, column } = parseQualifiedField(qualified);

  if (!table || table === rootTable) {
    return `${plan.rootEntity}_${column}`;
  }

  const join = joinForTable(table, plan.joins, schema, plan.rootEntity);
  const prefix = join?.refName ?? resolveEntityKey(table, schema) ?? table;
  return `${prefix}_${column}`;
}

function sqlColumn(entityKey: string, field: string, schema: MeshSchema): string {
  const config = schema.entities[entityKey];
  return config?.columns?.[field] ?? field;
}

function entityKeyForTable(
  table: string,
  plan: JoinPlan,
  schema: MeshSchema,
  rootTable: string,
): string {
  if (!table || table === rootTable) {
    return plan.rootEntity;
  }

  const join = joinForTable(table, plan.joins, schema, plan.rootEntity);
  return join?.entity ?? resolveEntityKey(table, schema) ?? table;
}

/**
 * Encode a cursor payload as a URL-safe opaque string.
 *
 * The current scheme uses `base64url(JSON.stringify(payload))` and only
 * populates the `id` field \u2014 keyset pagination is stable on the
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
  const selectParts: string[] = [];

  for (const qualified of plan.fields) {
    const { table, column } = parseQualifiedField(qualified);
    const tableName = table || rootTable;
    const entityKey = entityKeyForTable(table, plan, schema, rootTable);
    const sqlColumnName = sqlColumn(entityKey, column, schema);
    const alias = aliasForField(plan, schema, rootTable, qualified);
    // Aliases are quoted with double quotes so Postgres preserves the
    // original case. Unquoted identifiers fold to lowercase, which would
    // silently break the shaper's camelCase field lookup.
    selectParts.push(`${tableName}.${sqlColumnName} AS "${alias}"`);
  }

  let sql = `SELECT ${selectParts.join(", ")} FROM ${rootTable}`;

  const joinedTables = new Set<string>();

  for (const join of plan.joins) {
    const joinConfig = schema.joins[`${plan.rootEntity}.${join.refName}`];
    const joinTable =
      joinConfig?.table ?? entityTable(join.entity, schema.entities[join.entity]);

    if (joinedTables.has(joinTable)) {
      continue;
    }

    joinedTables.add(joinTable);
    sql += ` LEFT JOIN ${joinTable} ON ${join.on}`;
  }

  const whereClauses: string[] = [];

  // Point-read: /api/user/:id. Wins over list filters/cursor to keep the
  // route contract predictable.
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

  // ORDER BY: caller's explicit orderBy wins. For list reads with no
  // orderBy, we default to the id column so cursor pagination is stable.
  if (plan.list?.orderBy && plan.list.orderBy.length > 0) {
    sql += ` ORDER BY ${renderOrderBy(plan.list.orderBy, rootTable, plan.rootEntity, schema)}`;
  } else if (plan.list && plan.context.entityId === undefined) {
    sql += ` ORDER BY ${rootTable}.${idColumn} ASC`;
  }

  // LIMIT only for list reads. Point reads (entityId set) always yield at
  // most one root row and don't need a cap. When plan.list is unset the
  // resolver has explicitly opted into an unbounded read \u2014 rare, but
  // supported for backwards compatibility.
  if (plan.list && plan.context.entityId === undefined) {
    const limit = effectiveLimit(plan.list);
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }

  return { sql, params };
}
