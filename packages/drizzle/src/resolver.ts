import type { JoinPlan, MeshSchema, Resolver } from "@meshql/core";
import {
  buildDrizzleListArgs,
  buildDrizzleQuery,
  buildDrizzleWhere,
  drizzleQueryKey,
} from "./build-query.js";

export interface DrizzleQueryApi {
  findFirst(args?: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  findMany(args?: Record<string, unknown>): Promise<Record<string, unknown>[]>;
}

export type DrizzleDatabase = {
  query: Record<string, DrizzleQueryApi | undefined>;
};

export interface DrizzleResolverOptions {
  schema: MeshSchema;
}

/**
 * Create a catch-all MeshQL resolver backed by Drizzle's relational query API.
 *
 * ```ts
 * mesh.resolve("*", drizzleResolver(db, { schema }), { preshaped: true });
 * ```
 */
export function drizzleResolver(
  db: DrizzleDatabase,
  options: DrizzleResolverOptions,
): Resolver {
  const { schema } = options;

  return async (plan: JoinPlan) => {
    const tableKey = drizzleQueryKey(plan.rootEntity, schema);
    const queryApi = db.query[tableKey];
    if (!queryApi) {
      throw new Error(
        `No Drizzle query API for entity '${plan.rootEntity}' (expected db.query.${tableKey})`,
      );
    }

    const relationQuery = buildDrizzleQuery(plan, schema);
    const where = buildDrizzleWhere(plan, schema);

    if (plan.context.entityId !== undefined) {
      const row = await queryApi.findFirst({
        ...relationQuery,
        where,
      });
      return row ?? {};
    }

    const listArgs = buildDrizzleListArgs(plan, schema);
    return queryApi.findMany({
      ...relationQuery,
      ...listArgs,
      where,
    });
  };
}

/** Register a preshaped Drizzle catch-all resolver on a mesh instance. */
export function withDrizzle(
  mesh: { resolve(entity: string, resolver: Resolver, options?: { preshaped?: boolean }): unknown },
  db: DrizzleDatabase,
  options: DrizzleResolverOptions,
): void {
  mesh.resolve("*", drizzleResolver(db, options), { preshaped: true });
}
