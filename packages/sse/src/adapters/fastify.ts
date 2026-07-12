/**
 * Fastify routes for MeshQL SSE subscriptions.
 */
import type { MeshInstance } from "@meshql/core";
import { toErrorResponse } from "@meshql/http";
import type { FastifyPluginAsync } from "fastify";
import { handleMeshSse, type MeshSseOptions } from "../handler.js";

export interface MeshSseFastifyOptions extends MeshSseOptions {
  basePath?: string;
}

function toHttpRequest(request: {
  method: string;
  params: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
}) {
  return {
    method: request.method,
    params: {
      entity: request.params.entity,
      id: request.params.id,
    },
    headers: request.headers,
  };
}

/** Register MeshQL SSE routes on a Fastify instance. */
export function createMeshSseFastifyPlugin(
  mesh: MeshInstance,
  options: MeshSseFastifyOptions,
): FastifyPluginAsync {
  const basePath = options.basePath ?? "/mesh";

  return async (fastify) => {
    fastify.get(`${basePath}/:entity/:id/events`, async (request, reply) => {
      reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.hijack();

      try {
        await handleMeshSse(
          mesh,
          toHttpRequest({
            method: request.method,
            params: request.params as Record<string, string>,
            headers: request.headers as Record<string, string | string[] | undefined>,
          }),
          {
            write: (chunk) => {
              reply.raw.write(chunk);
            },
            end: () => {
              reply.raw.end();
            },
            onClose: (callback) => {
              request.raw.on("close", callback);
            },
          },
          options,
        );
      } catch (error) {
        const mapped = toErrorResponse(error);
        if (!reply.raw.headersSent) {
          reply.raw.statusCode = mapped.status;
          reply.raw.setHeader("Content-Type", "application/json");
          reply.raw.end(JSON.stringify(mapped.body));
          return;
        }
        reply.raw.end();
      }
    });
  };
}
