import type { MeshInstance } from "@meshql/core";
import { withAccess, type AccessOptions } from "@meshql/access";
import type { AccessRule } from "@meshql/core/builtins";
import type { JoinPlan, QueryContext } from "@meshql/core";
import {
  DEFAULT_ACCESS_CACHE_PREFIX,
  DEFAULT_ACCESS_CACHE_TTL_SECONDS,
  defaultPrincipal,
  dynamicRulesCacheKey,
  entityCacheKey,
  principalPrefix,
  rowCacheKey,
  ruleCacheKey,
} from "./keys.js";
import {
  InMemoryAccessCacheStore,
  readBoolean,
  readStringList,
  writeBoolean,
  writeStringList,
  type AccessCacheStore,
} from "./store.js";
import { createAccessCacheInvalidator, type AccessCacheInvalidator } from "./invalidation.js";

/** Options for {@link withAccessCache}. */
export interface AccessCacheOptions {
  store?: AccessCacheStore;
  /** Cache entry TTL. Defaults to 60 seconds. */
  ttlSeconds?: number;
  /** Key prefix for all cache entries. */
  prefix?: string;
  /** Derive the cache partition from request context. Defaults to userId:role:tenantId. */
  principal?: (ctx: QueryContext) => string;
}

function resolvedOptions(cacheOptions: AccessCacheOptions = {}) {
  return {
    store: cacheOptions.store ?? new InMemoryAccessCacheStore(),
    ttlSeconds: cacheOptions.ttlSeconds ?? DEFAULT_ACCESS_CACHE_TTL_SECONDS,
    prefix: cacheOptions.prefix ?? DEFAULT_ACCESS_CACHE_PREFIX,
    principal: cacheOptions.principal ?? defaultPrincipal,
  };
}

function prefixForContext(
  prefix: string,
  principal: (ctx: QueryContext) => string,
  ctx: QueryContext,
): string {
  return principalPrefix(prefix, principal(ctx));
}

function storeGetSync(store: AccessCacheStore, key: string): string | null | "async" {
  const result = store.get(key);
  if (result instanceof Promise) {
    return "async";
  }
  return result;
}

function wrapSyncBooleanRule(
  store: AccessCacheStore,
  ttlSeconds: number,
  prefix: string,
  principal: (ctx: QueryContext) => string,
  cacheSegment: (scopedPrefix: string) => string,
  rule: AccessRule,
): AccessRule {
  return (ctx) => {
    const key = cacheSegment(prefixForContext(prefix, principal, ctx));
    const raw = storeGetSync(store, key);
    if (raw === "async") {
      return rule(ctx);
    }

    if (raw !== null) {
      const cached = JSON.parse(raw) as { v?: boolean };
      if (typeof cached.v === "boolean") {
        return cached.v;
      }
    }

    const allowed = rule(ctx);
    const writeResult = store.set(key, JSON.stringify({ v: allowed }), ttlSeconds);
    if (writeResult instanceof Promise) {
      void writeResult;
    }
    return allowed;
  };
}

/** Wrap {@link AccessOptions} with cache lookups before rule evaluation. */
export function createCachedAccessOptions(
  options: AccessOptions,
  cacheOptions: AccessCacheOptions = {},
): AccessOptions {
  const { store, ttlSeconds, prefix, principal } = resolvedOptions(cacheOptions);
  const cached: AccessOptions = { ...options };

  if (options.rules) {
    cached.rules = Object.fromEntries(
      Object.entries(options.rules).map(([fieldPath, rule]) => [
        fieldPath,
        wrapSyncBooleanRule(store, ttlSeconds, prefix, principal, (scopedPrefix) =>
          ruleCacheKey(scopedPrefix, fieldPath),
        rule),
      ]),
    );
  }

  if (options.entityAccess) {
    cached.entityAccess = Object.fromEntries(
      Object.entries(options.entityAccess).map(([entity, rule]) => [
        entity,
        wrapSyncBooleanRule(store, ttlSeconds, prefix, principal, (scopedPrefix) =>
          entityCacheKey(scopedPrefix, entity),
        rule),
      ]),
    );
  }

  if (options.rowAccess) {
    cached.rowAccess = Object.fromEntries(
      Object.entries(options.rowAccess).map(([entity, rule]) => [
        entity,
        async (ctx, entityId) => {
          const key = rowCacheKey(
            prefixForContext(prefix, principal, ctx),
            entity,
            entityId,
          );
          const cachedResult = await readBoolean(store, key);
          if (cachedResult !== null) {
            return cachedResult;
          }

          const allowed = await rule(ctx, entityId);
          await writeBoolean(store, key, allowed, ttlSeconds);
          return allowed;
        },
      ]),
    );
  }

  if (options.dynamicRules) {
    const dynamicRules = options.dynamicRules;
    cached.dynamicRules = async (ctx, plan) => {
      const key = dynamicRulesCacheKey(
        prefixForContext(prefix, principal, ctx),
        plan,
      );
      const cachedFields = await readStringList(store, key);
      if (cachedFields !== null) {
        return cachedFields;
      }

      const allowed = await dynamicRules(ctx, plan);
      await writeStringList(store, key, allowed, ttlSeconds);
      return allowed;
    };
  }

  return cached;
}

export interface AccessCacheHandle {
  mesh: MeshInstance;
  invalidate: AccessCacheInvalidator;
}

/** Register cached access control on a mesh instance. */
export function withAccessCache(
  mesh: MeshInstance,
  accessOptions: AccessOptions,
  cacheOptions: AccessCacheOptions = {},
): AccessCacheHandle {
  const resolved = resolvedOptions(cacheOptions);
  withAccess(mesh, createCachedAccessOptions(accessOptions, resolved));
  return {
    mesh,
    invalidate: createAccessCacheInvalidator(resolved.store, {
      prefix: resolved.prefix,
    }),
  };
}

export { createAccessCacheInvalidator, type AccessCacheInvalidator } from "./invalidation.js";
