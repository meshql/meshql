import type { MeshInstance } from "../../index.js";
import type { MeshPlugin, PlanShortCircuit } from "../../plugin/types.js";
import type { QueryContext } from "../../resolver/context.js";
import type { MeshSchema } from "../../schema/schema.js";
import { stripFieldsFromPlan } from "../../planner/strip-fields.js";

/** Rule function for role-based field access. */
export type AccessRule = (ctx: QueryContext) => boolean;

/** Options for role-based field access control. */
export interface RoleAccessOptions {
  rules: Record<string, AccessRule>;
}

/** Register role-based field access on a mesh instance. */
export function withRoleAccess(
  mesh: MeshInstance,
  options: RoleAccessOptions,
): MeshInstance {
  return mesh.use(roleAccessPlugin(mesh.schema, options));
}

/** Create a role-based field access plugin. */
export function roleAccessPlugin(
  schema: MeshSchema,
  options: RoleAccessOptions,
): MeshPlugin {
  return {
    name: "role-access",

    onPlan(plan, ctx) {
      const denied: string[] = [];

      for (const [fieldPath, rule] of Object.entries(options.rules)) {
        if (!rule(ctx.queryContext)) {
          denied.push(fieldPath);
        }
      }

      if (denied.length === 0) {
        return plan;
      }

      return stripFieldsFromPlan(plan, denied, schema);
    },
  };
}

/** Short-circuit with an empty response (entity access denied). */
export function emptyResponse(list: boolean): PlanShortCircuit {
  return {
    shortCircuit: true,
    response: list ? [] : {},
  };
}
