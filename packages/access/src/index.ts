/**
 * Entity, row, and field access control for MeshQL.
 *
 * @module
 * @example
 * ```ts
 * import { createMesh } from "@meshql/core";
 * import { withAccess } from "@meshql/access";
 *
 * const mesh = createMesh({ entities: { user: { fields: ["id"], table: "users" } } });
 * withAccess(mesh, {
 *   entityAccess: { user: (ctx) => Boolean(ctx.userId) },
 * });
 * ```
 */
import type { MeshInstance } from "@meshql/core";
import {
  emptyResponse,
  type AccessRule,
} from "@meshql/core/builtins";
import type { MeshPlugin, PlanShortCircuit } from "@meshql/core";
import type { JoinPlan } from "@meshql/core";
import type { MeshSchema, QueryContext } from "@meshql/core";
import { stripFieldsFromPlan } from "@meshql/core";

export type { AccessRule };

/** Entity-level access rule. */
export type EntityAccessRule = (ctx: QueryContext) => boolean;

/** Row-level access rule. */
export type RowAccessRule = (
  ctx: QueryContext,
  entityId: string,
) => boolean | Promise<boolean>;

/** Options for advanced access control. */
export interface AccessOptions {
  rules?: Record<string, AccessRule>;
  dynamicRules?: (
    ctx: QueryContext,
    plan: JoinPlan,
  ) => Promise<string[]> | string[];
  entityAccess?: Record<string, EntityAccessRule>;
  rowAccess?: Record<string, RowAccessRule>;
}

function entityAccessPlugin(options: AccessOptions): MeshPlugin {
  return {
    name: "entity-access",
    onPlan(plan, ctx) {
      const rules = options.entityAccess;
      if (!rules) {
        return plan;
      }

      const rule = rules[plan.rootEntity];
      if (rule && !rule(ctx.queryContext)) {
        return emptyResponse(!ctx.queryContext.entityId);
      }

      return plan;
    },
  };
}

function fieldAccessPlugin(
  schema: MeshSchema,
  options: AccessOptions,
): MeshPlugin {
  return {
    name: "field-access",
    async onPlan(plan, ctx) {
      const denied: string[] = [];

      if (options.rules) {
        for (const [fieldPath, rule] of Object.entries(options.rules)) {
          if (!rule(ctx.queryContext)) {
            denied.push(fieldPath);
          }
        }
      }

      if (options.dynamicRules) {
        const allowed = await options.dynamicRules(ctx.queryContext, plan);
        const allowedSet = new Set(allowed);

        for (const field of plan.fields) {
          if (!allowedSet.has(field)) {
            denied.push(field);
          }
        }

        for (const join of plan.joins) {
          for (const field of join.fields) {
            if (!allowedSet.has(field)) {
              denied.push(field);
            }
          }
        }
      }

      if (denied.length === 0) {
        return plan;
      }

      return stripFieldsFromPlan(plan, denied, schema);
    },
  };
}

function rowAccessPlugin(options: AccessOptions): MeshPlugin {
  return {
    name: "row-access",
    async onPlan(plan, ctx) {
      const rules = options.rowAccess;
      if (!rules) {
        return plan;
      }

      const entityId = ctx.queryContext.entityId;
      if (!entityId) {
        return plan;
      }

      const rule = rules[plan.rootEntity];
      if (!rule) {
        return plan;
      }

      const allowed = await rule(ctx.queryContext, entityId);
      if (!allowed) {
        return emptyResponse(false);
      }

      return plan;
    },
  };
}

/** Register advanced access control on a mesh instance. */
export function withAccess(
  mesh: MeshInstance,
  options: AccessOptions,
): MeshInstance {
  mesh.use(entityAccessPlugin(options));
  mesh.use(fieldAccessPlugin(mesh.schema, options));
  mesh.use(rowAccessPlugin(options));
  return mesh;
}

export { stripFieldsFromPlan } from "@meshql/core";
