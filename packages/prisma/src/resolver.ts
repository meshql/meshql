import type { JoinPlan, MeshSchema, Resolver } from "@meshql/core";
import {
  buildPrismaListArgs,
  buildPrismaSelect,
  buildPrismaWhere,
  type PrismaSelect,
} from "./build-query.js";

/** Minimal Prisma model delegate used by {@link prismaResolver}. */
export interface PrismaModelDelegate {
  findUnique(args: {
    where: Record<string, unknown>;
    select?: PrismaSelect;
  }): Promise<Record<string, unknown> | null>;
  findMany(args: Record<string, unknown>): Promise<Record<string, unknown>[]>;
}

/** Prisma client shape — any client whose models are keyed by MeshQL entity name. */
export type PrismaClientLike = Record<string, PrismaModelDelegate | undefined>;

export interface PrismaResolverOptions {
  /** MeshQL schema used for field/column mapping. Required for nested selects. */
  schema: MeshSchema;
}

/**
 * Create a catch-all MeshQL resolver backed by Prisma.
 *
 * Register with preshaping enabled:
 *
 * ```ts
 * mesh.resolve("*", prismaResolver(prisma, { schema }), { preshaped: true });
 * ```
 */
export function prismaResolver(
  client: PrismaClientLike,
  options: PrismaResolverOptions,
): Resolver {
  const { schema } = options;

  return async (plan: JoinPlan) => {
    const model = client[plan.rootEntity];
    if (!model) {
      throw new Error(`No Prisma model delegate for entity '${plan.rootEntity}'`);
    }

    const select = buildPrismaSelect(plan, schema);
    const where = buildPrismaWhere(plan, schema);

    if (plan.context.entityId !== undefined) {
      const row = await model.findUnique({
        where: where ?? {},
        select,
      });
      return row ?? {};
    }

    const listArgs = buildPrismaListArgs(plan, schema);
    return model.findMany({
      select,
      ...listArgs,
    });
  };
}

/** Convenience helper that registers a preshaped Prisma catch-all resolver. */
export function withPrisma(
  mesh: { resolve(entity: string, resolver: Resolver, options?: { preshaped?: boolean }): unknown },
  client: PrismaClientLike,
  options: PrismaResolverOptions,
): void {
  mesh.resolve("*", prismaResolver(client, options), { preshaped: true });
}
