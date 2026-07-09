import type { MeshInstance } from "@meshql/core";
import {
  createHttpHandler,
  type HttpRequest,
} from "@meshql/http";
import { createRegisterQueryHandler } from "./middleware.js";
import type { QueryStore } from "./store.js";
import { InMemoryQueryStore } from "./store.js";

export interface PersistedQueriesConfig {
  store?: QueryStore;
}

export interface PersistedQueriesHttpRequest extends HttpRequest {
  path?: string;
}

/** Create an HTTP handler with query dispatch and registration routes. */
export function createPersistedQueriesHandler(
  mesh: MeshInstance,
  config: PersistedQueriesConfig = {},
): (req: PersistedQueriesHttpRequest) => Promise<{ status: number; body: unknown }> {
  const store = config.store ?? new InMemoryQueryStore();
  const queryHandler = createHttpHandler(mesh, {
    resolveQueryId: (id) => {
      const record = store.get(id);
      if (!record) {
        return undefined;
      }

      return {
        raw: record.raw,
        format: record.format,
      };
    },
  });
  const registerHandler = createRegisterQueryHandler(store);

  return async function persistedQueriesHandler(req: PersistedQueriesHttpRequest) {
    const path = req.path ?? "";
    const method = req.method.toUpperCase();

    if (path.endsWith("/queries") && method === "POST") {
      return registerHandler({ method: req.method, body: req.body });
    }

    return queryHandler(req);
  };
}

/** Convenience wrapper that exposes the store for registration in app code. */
export function withPersistedQueries(
  mesh: MeshInstance,
  config: PersistedQueriesConfig = {},
): MeshInstance & { queryStore: QueryStore } {
  const store = config.store ?? new InMemoryQueryStore();
  return Object.assign(mesh, { queryStore: store });
}

export { registerQuery, createQueryId, isQueryId } from "./register.js";
export { InMemoryQueryStore, contentKey } from "./store.js";
export type { QueryStore, PersistedQuery } from "./store.js";
export { handleRegisterQuery, createRegisterQueryHandler } from "./middleware.js";
