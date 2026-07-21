/**
 * Express router for MeshQL interactive docs / playground.
 */
import type { MeshInstance } from "@meshql/core";
import express, { type Request, type Response, type Router } from "express";
import { createDocsHandler, type DocsConfig } from "../index.js";

function toDocsRequest(req: Request) {
  return {
    method: req.method,
    path: req.originalUrl,
    headers: req.headers as Record<string, string | string[] | undefined>,
    body: req.body,
  };
}

/** Mount MeshQL docs routes (playground UI, schema, execute). */
export function meshDocsExpressRouter(
  mesh: MeshInstance,
  config: DocsConfig = {},
  basePath?: string,
): Router {
  const router = express.Router();
  const handler = createDocsHandler(mesh, {
    ...config,
    path: basePath ?? config.path ?? "/docs",
  });

  async function dispatch(req: Request, res: Response) {
    const result = await handler(toDocsRequest(req));
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }
    }
    if (typeof result.body === "string") {
      res.status(result.status).send(result.body);
      return;
    }
    res.status(result.status).json(result.body);
  }

  const mount = basePath ?? config.path ?? "/docs";

  router.get(mount, dispatch);
  router.get(`${mount}/`, dispatch);
  router.get(`${mount}/schema`, dispatch);
  router.post(`${mount}/execute`, express.json(), dispatch);

  return router;
}
