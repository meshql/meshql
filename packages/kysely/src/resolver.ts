import type { JoinPlan, MeshSchema, Resolver } from "@meshql/core";
import { buildSelectSql as buildPostgresSql } from "@meshql/postgres";
import { buildSelectSql as buildSqliteSql } from "@meshql/sqlite";

/** Supported SQL dialects for {@link kyselyResolver}. */
export type KyselyDialect = "postgres" | "sqlite";

/** Minimal Kysely database used to execute raw SQL from a join plan. */
export interface KyselyExecutor {
  executeQuery(
    compiled: { sql: string; parameters: readonly unknown[] },
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface KyselyResolverOptions {
  schema: MeshSchema;
  dialect: KyselyDialect;
}

function buildSql(plan: JoinPlan, schema: MeshSchema, dialect: KyselyDialect) {
  return dialect === "postgres"
    ? buildPostgresSql(plan, schema)
    : buildSqliteSql(plan, schema);
}

/**
 * Catch-all resolver that executes MeshQL join plans as parameterized SQL
 * through Kysely. Returns flat rows — register without `{ preshaped: true }`
 * so the MeshQL shaper nests the response.
 */
export function kyselyResolver(
  db: KyselyExecutor,
  options: KyselyResolverOptions,
): Resolver {
  const { schema, dialect } = options;

  return async (plan) => {
    const query = buildSql(plan, schema, dialect);
    const result = await db.executeQuery({
      sql: query.sql,
      parameters: query.params,
    });
    return result.rows;
  };
}

/** Register a Kysely catch-all resolver (flat rows, shaper runs). */
export function withKysely(
  mesh: { resolve(entity: string, resolver: Resolver): unknown },
  db: KyselyExecutor,
  options: KyselyResolverOptions,
): void {
  mesh.resolve("*", kyselyResolver(db, options));
}
