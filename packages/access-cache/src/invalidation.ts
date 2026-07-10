import {
  DEFAULT_ACCESS_CACHE_PREFIX,
  roleInvalidationPrefix,
  userInvalidationPrefix,
} from "./keys.js";
import type { AccessCacheStore } from "./store.js";

/** Manual cache invalidation API. */
export interface AccessCacheInvalidator {
  /** Drop cached permissions for a user ID. */
  invalidateUser(userId: string): Promise<number>;
  /** Drop cached permissions for a role (no userId / tenantId in principal). */
  invalidateRole(role: string): Promise<number>;
  /** Drop every cached permission entry under the configured prefix. */
  invalidateAll(): Promise<number>;
}

export interface AccessCacheInvalidatorOptions {
  prefix?: string;
}

export function createAccessCacheInvalidator(
  store: AccessCacheStore,
  options: AccessCacheInvalidatorOptions = {},
): AccessCacheInvalidator {
  const prefix = options.prefix ?? DEFAULT_ACCESS_CACHE_PREFIX;

  async function removeByPrefix(scopedPrefix: string): Promise<number> {
    const result = store.deleteByPrefix(scopedPrefix);
    return result instanceof Promise ? result : result;
  }

  return {
    invalidateUser(userId) {
      return removeByPrefix(userInvalidationPrefix(prefix, userId));
    },
    invalidateRole(role) {
      return removeByPrefix(roleInvalidationPrefix(prefix, role));
    },
    invalidateAll() {
      return removeByPrefix(prefix);
    },
  };
}
