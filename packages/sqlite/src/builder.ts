import type {
  Filter,
  JoinPlan,
  ListOptions,
  MeshSchema,
  OrderBy,
  SortExpr,
} from "@meshql/core";
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  buildPathToSqlAlias,
  entityTable,
  joinsInDependencyOrder,
  physicalTableForJoin,
  renderReadWhereSql,
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
 * and use {@link encodeCursor} / {@link decodeCursor} to round-trip through
 * it. The wire format is identical to `@meshql/postgres` so a client can
 * swap adapters without re-issuing cursors.
 */
export interface CursorPayload {
  id: unknown;
}

function sqlColumn(entityKey: string, field: string, schema: MeshSchema): string {
  const config = schema.entities[entityKey];
  return config?.columns?.[field] ?? field;
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
 *   SQLite builds — for full ILIKE parity, install the `unicode`
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

function renderReadOrderBy(
  orderBy: SortExpr[],
  rootTable: string,
  rootEntityKey: string,
  schema: MeshSchema,
): string {
  return orderBy
    .filter((entry): entry is Extract<SortExpr, { field: string }> => "field" in entry)
    .map((entry) => {
      const column = sqlColumn(rootEntityKey, entry.field, schema);
      const dir = entry.direction === "desc" ? "DESC" : "ASC";
      return `${rootTable}.${column} ${dir}`;
    })
    .join(", ");
}

function effectiveLimit(list: ListOptions | undefined, plan: JoinPlan): number {
  const requested =
    plan.read?.page?.first ?? list?.limit ?? DEFAULT_LIST_LIMIT;
  const capped = Math.min(requested, MAX_LIST_LIMIT);
  return plan.read?.page ? capped + 1 : capped;
}

export function buildAggregateSql(
  plan: JoinPlan,
  schema: MeshSchema,
  options: SqlBuilderOptions = {},
): SqlQuery {
  const read = plan.read;
  if (!read?.groupBy?.length || !read.aggregates) {
    throw new Error("Aggregate query requires groupBy and aggregates");
  }
  const rootConfig = schema.entities[plan.rootEntity];
  if (!rootConfig) throw new Error(`Unknown root entity '${plan.rootEntity}'`);
  const rootTable = entityTable(plan.rootEntity, rootConfig);
  const params: unknown[] = [];
  const selectParts = read.groupBy.map((field) => {
    const column = sqlColumn(plan.rootEntity, field, schema);
    return `${rootTable}.${column} AS "${field}"`;
  });
  for (const [alias, spec] of Object.entries(read.aggregates)) {
    const fn = spec.fn.toUpperCase();
    const field = spec.field ?? "*";
    const distinct = spec.distinct ? "DISTINCT " : "";
    const expr =
      field === "*"
        ? `${fn}(*)`
        : `${fn}(${distinct}${rootTable}.${sqlColumn(plan.rootEntity, field, schema)})`;
    selectParts.push(`${expr} AS "${alias}"`);
  }
  let sql = `SELECT ${selectParts.join(", ")} FROM ${rootTable}`;
  const whereClauses = renderReadWhereSql(
    read,
    rootTable,
    plan.rootEntity,
    schema,
    params,
    "sqlite",
  );
  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(" AND ")}`;
  }
  sql += ` GROUP BY ${read.groupBy
    .map((field) => `${rootTable}.${sqlColumn(plan.rootEntity, field, schema)}`)
    .join(", ")}`;
  if (read.orderBy.length > 0) {
    sql += ` ORDER BY ${renderReadOrderBy(read.orderBy, rootTable, plan.rootEntity, schema)}`;
  }
  if (read.page && plan.context.entityId === undefined) {
    params.push(effectiveLimit(plan.list, plan));
    sql += ` LIMIT ?`;
  }
  return { sql, params };
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
 * SQLite, and Cloudflare D1 — all of which accept `?`-style placeholders.
 */
export function buildSelectSql(
  plan: JoinPlan,
  schema: MeshSchema,
  options: SqlBuilderOptions = {},
): SqlQuery {
  if (plan.read?.mode === "aggregate") {
    return buildAggregateSql(plan, schema, options);
  }
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
    whereClauses.push(`${rootTable}.${idColumn} = ?`);
  } else if (plan.list || plan.read?.page) {
    if (plan.read?.where || plan.read?.page?.after) {
      whereClauses.push(
        ...renderReadWhereSql(
          plan.read,
          rootTable,
          plan.rootEntity,
          schema,
          params,
          "sqlite",
        ),
      );
    } else if (plan.list?.filter) {
      for (const filter of plan.list.filter) {
        whereClauses.push(
          renderFilter(filter, rootTable, plan.rootEntity, schema, params),
        );
      }
    }

    if (!plan.read?.page?.after && plan.list?.cursor) {
      const cursor = decodeCursor(plan.list.cursor);
      params.push(cursor.id);
      whereClauses.push(`${rootTable}.${idColumn} > ?`);
    }
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(" AND ")}`;
  }

  if (plan.context.entityId === undefined) {
    if (plan.read?.orderBy && plan.read.orderBy.length > 0) {
      sql += ` ORDER BY ${renderReadOrderBy(plan.read.orderBy, rootTable, plan.rootEntity, schema)}`;
    } else if (plan.list?.orderBy && plan.list.orderBy.length > 0) {
      sql += ` ORDER BY ${renderOrderBy(plan.list.orderBy, rootTable, plan.rootEntity, schema)}`;
    } else if (plan.list || plan.read?.page) {
      sql += ` ORDER BY ${rootTable}.${idColumn} ASC`;
    }
  }

  if ((plan.list || plan.read?.page) && plan.context.entityId === undefined) {
    const limit = effectiveLimit(plan.list, plan);
    params.push(limit);
    sql += ` LIMIT ?`;
  }

  return { sql, params };
}
