/**
 * Fastify plugin for MeshQL HTTP endpoints.
 *
 * @module
 *
 * @example
 * ```ts
 * import Fastify from "fastify";
 * import { createMesh } from "@meshql/core";
 * import { createMeshFastifyPlugin } from "@meshql/http/fastify";
 *
 * const app = Fastify();
 * await app.register(createMeshFastifyPlugin(createMesh({ entities: {} })));
 * ```
 */
import type { MeshInstance } from "@meshql/core";
import type { FastifyPluginAsync } from "fastify";
import { createMeshHttpHandler, toHttpRequest } from "./shared.js";

/** Options for the MeshQL Fastify plugin. */
export interface MeshFastifyOptions {
  basePath?: string;
}

/** Create a Fastify plugin that serves MeshQL routes. */
export function createMeshFastifyPlugin(
  mesh: MeshInstance,
  options: MeshFastifyOptions = {},
): FastifyPluginAsync {
  const basePath = options.basePath ?? "/mesh";
  const handler = createMeshHttpHandler(mesh);

  const plugin: FastifyPluginAsync = async (fastify) => {
    const dispatch = async (request: {
      method: string;
      params: Record<string, string>;
      headers: Record<string, string | string[] | undefined>;
      body?: unknown;
    }) => {
      const result = await handler(
        toHttpRequest({
          method: request.method,
          params: {
            entity: request.params.entity,
            id: request.params.id,
          },
          headers: request.headers,
          body: request.body,
        }),
      );
      return result;
    };

    fastify.get(`${basePath}/:entity/:id`, async (request, reply) => {
      const result = await dispatch({
        method: request.method,
        params: request.params as Record<string, string>,
        headers: request.headers as Record<string, string | string[] | undefined>,
        body: request.body,
      });
      return reply.status(result.status).send(result.body);
    });

    fastify.get(`${basePath}/:entity`, async (request, reply) => {
      const result = await dispatch({
        method: request.method,
        params: request.params as Record<string, string>,
        headers: request.headers as Record<string, string | string[] | undefined>,
        body: request.body,
      });
      return reply.status(result.status).send(result.body);
    });

    fastify.post(basePath, async (request, reply) => {
      const result = await dispatch({
        method: request.method,
        params: {},
        headers: request.headers as Record<string, string | string[] | undefined>,
        body: request.body,
      });
      return reply.status(result.status).send(result.body);
    });

    fastify.put(`${basePath}/:entity/:id`, async (request, reply) => {
      const result = await dispatch({
        method: request.method,
        params: request.params as Record<string, string>,
        headers: request.headers as Record<string, string | string[] | undefined>,
        body: request.body,
      });
      return reply.status(result.status).send(result.body);
    });
  };

  return plugin;
}
