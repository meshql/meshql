/**
 * Hono routes for MeshQL HTTP endpoints.
 *
 * @module
 *
 * @example
 * ```ts
 * import { Hono } from "hono";
 * import { createMesh } from "@meshql/core";
 * import { meshHonoRoutes } from "@meshql/http/hono";
 *
 * const app = new Hono();
 * app.route("/", meshHonoRoutes(createMesh({ entities: {} })));
 * ```
 */
import type { MeshInstance } from "@meshql/core";
import { Hono } from "hono";
import type { Context } from "hono";
import { Readable } from "node:stream";
import { handleUpload } from "../handlers/upload.js";
import { toErrorResponse } from "../index.js";
import { createMeshHttpHandler, toHttpRequest } from "./shared.js";

/** Options for {@link meshHonoRoutes}. */
export interface MeshHonoOptions {
  basePath?: string;
  /** Max multipart upload size in bytes. Default 25 MiB. */
  maxUploadBytes?: number;
}

/** Create Hono routes that serve MeshQL endpoints. */
export function meshHonoRoutes(
  mesh: MeshInstance,
  options: MeshHonoOptions = {},
): Hono {
  const basePath = options.basePath ?? "/mesh";
  const app = new Hono();
  const handler = createMeshHttpHandler(mesh);
  const maxBytes = options.maxUploadBytes;

  async function run(c: Context, params: { entity?: string; id?: string }) {
    const headers: Record<string, string | string[] | undefined> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let body: unknown;
    if (c.req.method === "POST" || c.req.method === "PUT") {
      try {
        body = await c.req.json();
      } catch {
        body = undefined;
      }
    }

    const result = await handler(
      toHttpRequest({
        method: c.req.method,
        params,
        headers,
        body,
      }),
    );

    return c.json(result.body, result.status as 200 | 400 | 500);
  }

  async function upload(
    c: Context,
    params: { entity?: string; id?: string; field?: string },
  ) {
    const headers: Record<string, string | string[] | undefined> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });

    try {
      const webBody = c.req.raw.body;
      if (!webBody) {
        const mapped = toErrorResponse(new Error("Missing request body"));
        return c.json(mapped.body, mapped.status as 400);
      }
      const stream = Readable.fromWeb(webBody as import("node:stream/web").ReadableStream);
      const body = await handleUpload(mesh, {
        method: c.req.method,
        params,
        headers,
        stream,
        maxBytes,
      });
      return c.json(body, 200);
    } catch (error) {
      const mapped = toErrorResponse(error);
      return c.json(mapped.body, mapped.status as 400 | 401 | 500);
    }
  }

  app.post(`${basePath}/:entity/:id/:field`, (c) =>
    upload(c, {
      entity: c.req.param("entity"),
      id: c.req.param("id"),
      field: c.req.param("field"),
    }),
  );
  app.post(`${basePath}/:entity`, (c) =>
    upload(c, { entity: c.req.param("entity") }),
  );

  app.get(`${basePath}/:entity/:id`, (c) =>
    run(c, { entity: c.req.param("entity"), id: c.req.param("id") }),
  );
  app.get(`${basePath}/:entity`, (c) => run(c, { entity: c.req.param("entity") }));
  app.post(basePath, (c) => run(c, {}));
  app.put(`${basePath}/:entity/:id`, (c) =>
    run(c, { entity: c.req.param("entity"), id: c.req.param("id") }),
  );

  return app;
}
