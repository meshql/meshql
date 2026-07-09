/**
 * Express router with persisted query registration for MeshQL.
 */
import type { MeshInstance } from "@meshql/core";
import express, { type Request, type Response, type Router } from "express";
import { createPersistedQueriesHandler } from "../index.js";
import type { PersistedQueriesConfig } from "../index.js";

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toHttpRequest(req: Request) {
  return {
    method: req.method,
    params: {
      entity: param(req.params.entity),
      id: param(req.params.id),
    },
    headers: req.headers as Record<string, string | string[] | undefined>,
    body: req.body,
    path: req.path,
  };
}

/** Mount MeshQL routes with POST /mesh/queries registration. */
export function meshPersistedQueriesExpressRouter(
  mesh: MeshInstance,
  config: PersistedQueriesConfig = {},
  basePath = "/mesh",
): Router {
  const router = express.Router();
  const handler = createPersistedQueriesHandler(mesh, config);

  async function dispatch(req: Request, res: Response) {
    const result = await handler(toHttpRequest(req));
    res.status(result.status).json(result.body);
  }

  router.post(`${basePath}/queries`, dispatch);
  router.get(`${basePath}/:entity/:id`, dispatch);
  router.get(`${basePath}/:entity`, dispatch);
  router.post(basePath, dispatch);
  router.put(`${basePath}/:entity/:id`, dispatch);

  return router;
}
