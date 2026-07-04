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
 * and use {@link encodeCursor} / {@link decodeCursor} to round-trip through
 * it. The wire format is identical to `@meshql/postgres` so a client can
 * swap adapters without re-issuing cursors.
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

/** Map a field prefix (ref name or entity) to the real SQL table name. */
function sqlTableForPrefix(
  table: string,
  plan: JoinPlan,
  schema: MeshSchema,
  rootTable: string,
): string {
  if (!table || table === rootTable || table === plan.rootEntity) {
    return rootTable;
  }

  const join = joinForTable(table, plan.joins, schema, plan.rootEntity);
  if (!join) {
    return table;
  }

  const joinConfig = schema.joins[`${plan.rootEntity}.${join.refName}`];
  return (
    joinConfig?.table ??
    entityTable(join.entity, schema.entities[join.entity])
  );
}

/**
 * Encode a cursor payload as a URL-safe opaque string.
 *
 * Wire-compatible with `@meshql/postgres` cursors so clients can migrate
 * between adapters without re-issuing pagination state.
 */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Decode a cursor string produced by {@link encodeCursor}. Throws for
 * malformed base64, malformed JSON, or missing `id`.
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

/**
 * Render a single {@link Filter} into a SQL fragment and push its value(s)
 * into `params`.
 *
 * Divergences from `@meshql/postgres`:
 * - `in` / `nin` expand into `IN (?, ?, ?)` / `NOT IN (?, ?, ?)` because
 *   SQLite has no native ARRAY type.
 * - `ilike` renders as `LIKE`; SQLite's built-in `LIKE` is case-insensitive
 *   for ASCII by default. Unicode case-folding is not portable across
 *   SQLite builds \u2014 for full ILIKE parity, install the `unicode`
 *   extension.
 */
function renderFilter(
  filter: Filter,
  rootTable: string,
  rootEntityKey: string,
  schema: MeshSchema,
  params: unknown[],
): string {
  const column = sqlColumn(rootEntityKey, filter.field, schema);

  if (filter.op === "in" || filter.op === "nin") {
    if (!Array.isArray(filter.value)) {
      throw new Error(`Filter '${filter.field} ${filter.op}' requires an array value`);
    }
    if (filter.value.length === 0) {
      // Empty IN () is a SQL syntax error in SQLite. Emit a tautologically
      // false / true predicate so the query still parses.
      return filter.op === "in" ? "0 = 1" : "1 = 1";
    }
    for (const v of filter.value) {
      params.push(v);
    }
    const placeholders = filter.value.map(() => "?").join(", ");
    const op = filter.op === "in" ? "IN" : "NOT IN";
    return `${rootTable}.${column} ${op} (${placeholders})`;
  }

  const opSql: Record<Exclude<Filter["op"], "in" | "nin">, string> = {
    eq: "=",
    ne: "<>",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    like: "LIKE",
    ilike: "LIKE",
  };

  params.push(filter.value);
  return `${rootTable}.${column} ${opSql[filter.op]} ?`;
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

/**
 * Build a parameterized SELECT statement for SQLite-style databases.
 *
 * Differences from {@link "@meshql/postgres".buildSelectSql}:
 *
 * - Parameter placeholders are positional `?` instead of numbered `$1`, `$2`.
 *   The returned `params` array is in the same order the engine will bind it.
 * - `IN`/`NOT IN` filters expand into positional lists (no ARRAY type).
 * - `ilike` degrades to `LIKE` (case-insensitive for ASCII in SQLite's
 *   default configuration).
 *
 * Compatible with Node 22.5+'s built-in `node:sqlite`, Bun's built-in
 * SQLite, and Cloudflare D1 \u2014 all of which accept `?`-style placeholders.
 */
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
    const tableName = sqlTableForPrefix(table, plan, schema, rootTable);
    const entityKey = entityKeyForTable(table, plan, schema, rootTable);
    const sqlColumnName = sqlColumn(entityKey, column, schema);
    const alias = aliasForField(plan, schema, rootTable, qualified);
    // Aliases are double-quoted so SQLite preserves the original case used
    // by the shaper. SQLite is already case-insensitive, but quoting keeps
    // the wire format consistent with `@meshql/postgres`.
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
    whereClauses.push(`${rootTable}.${idColumn} = ?`);
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
      whereClauses.push(`${rootTable}.${idColumn} > ?`);
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

  // LIMIT only for list reads. Point reads always yield at most one root
  // row and don't need a cap. When plan.list is unset the resolver has
  // explicitly opted into an unbounded read \u2014 rare, but supported.
  if (plan.list && plan.context.entityId === undefined) {
    const limit = effectiveLimit(plan.list);
    params.push(limit);
    sql += ` LIMIT ?`;
  }

  return { sql, params };
}
