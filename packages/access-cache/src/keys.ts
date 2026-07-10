import { createHash } from "node:crypto";
import type { JoinPlan } from "@meshql/core";
import type { QueryContext } from "@meshql/core";

export const DEFAULT_ACCESS_CACHE_PREFIX = "meshql:access:";
export const DEFAULT_ACCESS_CACHE_TTL_SECONDS = 60;

export function defaultPrincipal(ctx: QueryContext): string {
  return [ctx.userId ?? "", ctx.role ?? "", ctx.tenantId ?? ""].join(":");
}

export function principalPrefix(basePrefix: string, principal: string): string {
  const digest = createHash("sha256").update(principal).digest("hex").slice(0, 16);
  return `${basePrefix}p:${digest}:`;
}

export function ruleCacheKey(prefix: string, fieldPath: string): string {
  return `${prefix}rule:${fieldPath}`;
}

export function entityCacheKey(prefix: string, entity: string): string {
  return `${prefix}entity:${entity}`;
}

export function rowCacheKey(prefix: string, entity: string, entityId: string): string {
  return `${prefix}row:${entity}:${entityId}`;
}

export function dynamicRulesCacheKey(prefix: string, plan: JoinPlan): string {
  const fields = [
    plan.rootEntity,
    ...plan.fields,
    ...plan.joins.flatMap((join) => [join.entity, ...join.fields]),
  ].join("|");
  const digest = createHash("sha256").update(fields).digest("hex").slice(0, 16);
  return `${prefix}dynamic:${plan.rootEntity}:${digest}`;
}

export function userInvalidationPrefix(basePrefix: string, userId: string): string {
  const digest = createHash("sha256")
    .update([userId, "", ""].join(":"))
    .digest("hex")
    .slice(0, 16);
  return `${basePrefix}p:${digest}:`;
}

export function roleInvalidationPrefix(
  basePrefix: string,
  role: string,
): string {
  const digest = createHash("sha256")
    .update(["", role, ""].join(":"))
    .digest("hex")
    .slice(0, 16);
  return `${basePrefix}p:${digest}:`;
}
