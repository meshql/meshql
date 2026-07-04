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
import type { Readable } from "node:stream";
import { handleUpload } from "../handlers/upload.js";
import { toErrorResponse } from "../index.js";
import { createMeshHttpHandler, toHttpRequest } from "./shared.js";

/** Options for the MeshQL Fastify plugin. */
export interface MeshFastifyOptions {
  basePath?: string;
  /** Max multipart upload size in bytes. Default 25 MiB. */
  maxUploadBytes?: number;
}

/** Create a Fastify plugin that serves MeshQL routes. */
export function createMeshFastifyPlugin(
  mesh: MeshInstance,
  options: MeshFastifyOptions = {},
): FastifyPluginAsync {
  const basePath = options.basePath ?? "/mesh";
  const handler = createMeshHttpHandler(mesh);
  const maxBytes = options.maxUploadBytes;

  const plugin: FastifyPluginAsync = async (fastify) => {
    fastify.addContentTypeParser(
      "multipart/form-data",
      (_request, payload, done) => {
        done(null, payload);
      },
    );

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

    const upload = async (request: {
      method: string;
      params: unknown;
      headers: Record<string, string | string[] | undefined>;
      body?: unknown;
      raw: Readable;
    }, reply: { status(code: number): { send(body: unknown): unknown } }) => {
      try {
        const params = request.params as Record<string, string>;
        const stream =
          request.body && typeof request.body === "object" && "pipe" in request.body
            ? (request.body as Readable)
            : request.raw;
        const body = await handleUpload(mesh, {
          method: request.method,
          params: {
            entity: params.entity,
            id: params.id,
            field: params.field,
          },
          headers: request.headers,
          stream,
          maxBytes,
        });
        return reply.status(200).send(body);
      } catch (error) {
        const mapped = toErrorResponse(error);
        return reply.status(mapped.status).send(mapped.body);
      }
    };

    fastify.post(`${basePath}/:entity/:id/:field`, async (request, reply) =>
      upload(request as never, reply),
    );
    fastify.post(`${basePath}/:entity`, async (request, reply) =>
      upload(request as never, reply),
    );

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
