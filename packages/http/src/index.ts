/**
 * HTTP transport for MeshQL queries and framework-agnostic request handling.
 *
 * @module
 *
 * @example
 * ```ts
 * import { createMesh } from "@meshql/core";
 * import { createHttpHandler } from "@meshql/http";
 *
 * const mesh = createMesh({ entities: { user: { table: "users" } } });
 * const handler = createHttpHandler(mesh);
 *
 * const { status, body } = await handler({
 *   method: "GET",
 *   params: { entity: "user", id: "123" },
 *   headers: { "x-mesh-query": "...", "x-mesh-format": "json" },
 * });
 * ```
 */
import type { MeshInstance } from "@meshql/core";
import { MeshError } from "@meshql/core";
import {
  handleDelete,
  handleGet,
  handlePost,
  handlePut,
  type HttpRequest,
} from "./handlers/index.js";

/** Options for {@link createHttpHandler}. */
export interface HttpHandlerOptions {
  basePath?: string;
}

/** Low-level HTTP handler for MeshQL requests. */
export type MeshHttpHandler = (
  req: HttpRequest,
) => Promise<{ status: number; body: unknown }>;

function toErrorResponse(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof MeshError) {
    const status =
      error.code === "IntegrityError"
        ? 401
        : error.code === "ValidationError" || error.code === "TransportError"
          ? 400
          : error.code === "ResolverError"
            ? 500
            : error.code === "RateLimitError"
              ? 429
              : 400;

    return {
      status,
      body: {
        error: error.code,
        message: error.message,
        ...error.details,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "InternalError",
      message: error instanceof Error ? error.message : "Unknown error",
    },
  };
}

/** Create a framework-agnostic MeshQL HTTP handler. */
export function createHttpHandler(
  mesh: MeshInstance,
  _options: HttpHandlerOptions = {},
): MeshHttpHandler {
  return async function meshHttpHandler(req: HttpRequest) {
    try {
      const method = req.method.toUpperCase();

      if (method === "GET") {
        return { status: 200, body: await handleGet(mesh, req) };
      }
      if (method === "POST") {
        return { status: 200, body: await handlePost(mesh, req) };
      }
      if (method === "PUT") {
        return { status: 200, body: await handlePut(mesh, req) };
      }
      if (method === "DELETE") {
        return { status: 200, body: handleDelete(mesh, req) };
      }

      throw new MeshError(`Unsupported method ${method}`, "TransportError");
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export { decodeQuery, encodeQuery, readTransportHeaders, signQuery } from "./transport/decode.js";
export type { DecodedQuery, QueryFormat, SignQueryOptions } from "./transport/decode.js";
export type { HttpRequest } from "./handlers/index.js";
