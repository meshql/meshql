import { MeshError } from "@meshql/core";
import type { QueryFormat } from "@meshql/http";
import { registerQuery } from "./register.js";
import type { QueryStore } from "./store.js";

export interface RegisterQueryHttpRequest {
  method: string;
  body?: unknown;
}

/** Handle POST /{base}/queries — register a query and return its ID. */
export function handleRegisterQuery(
  store: QueryStore,
  req: RegisterQueryHttpRequest,
): { id: string } {
  if (req.method.toUpperCase() !== "POST") {
    throw new MeshError("Method not allowed", "TransportError");
  }

  const body = req.body as { query?: string; format?: QueryFormat } | undefined;
  const query = body?.query;

  if (!query || typeof query !== "string") {
    throw new MeshError("POST body must include a query string", "TransportError");
  }

  const format = body?.format ?? "json";
  if (format !== "json" && format !== "ql") {
    throw new MeshError(`Unknown format '${format}' - use json or ql`, "TransportError");
  }

  return { id: registerQuery(store, query, format) };
}

export type RegisterQueryHandler = (
  req: RegisterQueryHttpRequest,
) => Promise<{ status: number; body: unknown }>;

/** Create a framework-agnostic registration route handler. */
export function createRegisterQueryHandler(store: QueryStore): RegisterQueryHandler {
  return async function registerQueryHandler(req) {
    try {
      return { status: 200, body: handleRegisterQuery(store, req) };
    } catch (error) {
      if (error instanceof MeshError) {
        return {
          status: error.code === "TransportError" ? 400 : 401,
          body: { error: error.code, message: error.message, ...error.details },
        };
      }
      throw error;
    }
  };
}
