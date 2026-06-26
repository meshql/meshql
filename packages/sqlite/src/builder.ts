import type { JoinPlan, ResolvedJoin, MeshSchema } from "@meshql/core";
import { entityTable } from "@meshql/core";

/** Parameterized SQL query generated from a join plan. */
export interface SqlQuery {
  sql: string;
  params: unknown[];
}

/** Options for {@link buildSelectSql}. */
export interface SqlBuilderOptions {
  idColumn?: string;
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
  const prefix = join?.refName ?? table.replace(/s$/, "");
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
  return join?.entity ?? table.replace(/s$/, "");
}

/**
 * Build a parameterized SELECT statement for SQLite-style databases.
 *
 * Differences from {@link "@meshql/postgres".buildSelectSql}:
 *
 * - Parameter placeholders are positional `?` instead of numbered `$1`, `$2`.
 *   The returned `params` array is in the same order the engine will bind it.
 *
 * Compatible with Node 22.5+'s built-in `node:sqlite`, Bun's built-in
 * SQLite, and Cloudflare D1 — all of which accept `?`-style placeholders.
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
  const params: unknown[] = [];
  const selectParts: string[] = [];

  for (const qualified of plan.fields) {
    const { table, column } = parseQualifiedField(qualified);
    const tableName = table || rootTable;
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

  const idColumn = options.idColumn ?? "id";
  if (plan.context.entityId !== undefined) {
    params.push(plan.context.entityId);
    sql += ` WHERE ${rootTable}.${idColumn} = ?`;
  }

  return { sql, params };
}
