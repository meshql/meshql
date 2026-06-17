import type { MeshInstance } from "@meshql/core";
import { Hono } from "hono";
import type { Context } from "hono";
import { createMeshHttpHandler, toHttpRequest } from "./shared.js";

export interface MeshHonoOptions {
  basePath?: string;
}

export function meshHonoRoutes(
  mesh: MeshInstance,
  options: MeshHonoOptions = {},
): Hono {
  const basePath = options.basePath ?? "/mesh";
  const app = new Hono();
  const handler = createMeshHttpHandler(mesh);

  async function run(
    c: Context,
    params: { entity?: string; id?: string },
  ) {
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

  app.get(`${basePath}/:entity/:id`, (c) =>
    run(c, { entity: c.req.param("entity"), id: c.req.param("id") }),
  );
  app.get(`${basePath}/:entity`, (c) =>
    run(c, { entity: c.req.param("entity") }),
  );
  app.post(basePath, (c) => run(c, {}));
  app.put(`${basePath}/:entity/:id`, (c) =>
    run(c, { entity: c.req.param("entity"), id: c.req.param("id") }),
  );
  app.delete(`${basePath}/:entity/:id`, (c) =>
    run(c, { entity: c.req.param("entity"), id: c.req.param("id") }),
  );

  return app;
}
