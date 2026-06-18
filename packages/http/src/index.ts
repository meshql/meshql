import type { MeshInstance } from "@meshql/core";
import { MeshError } from "@meshql/core";
import {
  handleDelete,
  handleGet,
  handlePost,
  handlePut,
  type HttpRequest,
} from "./handlers/index.js";

export interface HttpHandlerOptions {
  basePath?: string;
}

export type MeshHttpHandler = (
  req: HttpRequest,
) => Promise<{ status: number; body: unknown }>;

function toErrorResponse(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof MeshError) {
    const status =
      error.code === "ValidationError" || error.code === "TransportError"
        ? 400
        : error.code === "ResolverError"
          ? 500
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

export { decodeQuery, encodeQuery } from "./transport/decode.js";
export type { DecodedQuery, QueryFormat } from "./transport/decode.js";
