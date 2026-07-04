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
import {
  IntegrityError,
  MeshError,
  ParseError,
  RateLimitError,
  ResolverError,
  TransportError,
  ValidationError,
} from "@meshql/core";
import {
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

function statusForError(error: MeshError): number {
  if (error instanceof IntegrityError) return 401;
  if (error instanceof RateLimitError) return 429;
  if (error instanceof ValidationError) return 400;
  if (error instanceof TransportError) return 400;
  if (error instanceof ParseError) return 400;
  if (error instanceof ResolverError) return 500;
  return 400;
}

/** Map any thrown value to an HTTP status and JSON error body. */
export function toErrorResponse(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (error instanceof MeshError) {
    return {
      status: statusForError(error),
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

      // DELETE and other mutating verbs are not part of v0.2 — a generic
      // mutation story arrives later. Returning 405 is more honest than the
      // previous no-op handler that echoed back fake success.
      return {
        status: 405,
        body: {
          error: "TransportError",
          message: `Unsupported method ${method}`,
        },
      };
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export {
  decodeQuery,
  encodeQuery,
  readTransportHeaders,
  signQuery,
} from "./transport/decode.js";
export type {
  DecodedQuery,
  QueryFormat,
  SignQueryOptions,
} from "./transport/decode.js";
export { parseMultipart, hashFileContent } from "./transport/multipart.js";
export type {
  ParseMultipartOptions,
  ParsedMultipart,
} from "./transport/multipart.js";
export { handleUpload, extractUploadField } from "./handlers/upload.js";
export type { UploadHttpRequest } from "./handlers/upload.js";
export type { HttpRequest } from "./handlers/index.js";
