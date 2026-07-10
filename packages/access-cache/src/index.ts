export {
  withAccessCache,
  createCachedAccessOptions,
  type AccessCacheOptions,
  type AccessCacheHandle,
} from "./cache-wrapper.js";

export {
  InMemoryAccessCacheStore,
  serializeCacheValue,
  deserializeCacheValue,
  type AccessCacheStore,
  type AccessCacheValue,
} from "./store.js";

export {
  createAccessCacheInvalidator,
  type AccessCacheInvalidator,
  type AccessCacheInvalidatorOptions,
} from "./invalidation.js";

export {
  UpstashAccessCacheStore,
  createRedisAccessCacheStore,
  type UpstashAccessCacheOptions,
} from "./upstash.js";

export {
  DEFAULT_ACCESS_CACHE_PREFIX,
  DEFAULT_ACCESS_CACHE_TTL_SECONDS,
  defaultPrincipal,
} from "./keys.js";
