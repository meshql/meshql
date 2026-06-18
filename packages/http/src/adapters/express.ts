/**
 * Express router and middleware helpers for MeshQL.
 *
 * @module
 *
 * @example
 * ```ts
 * import express from "express";
 * import { createMesh } from "@meshql/core";
 * import { meshExpressRouter } from "@meshql/http/express";
 *
 * const app = express();
 * app.use(meshExpressRouter(createMesh({ entities: {} }), "/mesh"));
 * ```
 */
import type { MeshInstance } from "@meshql/core";
import express, { type Request, type RequestHandler, type Response, type Router } from "express";
import { createMeshHttpHandler, toHttpRequest } from "./shared.js";

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Mount MeshQL routes on an Express router. */
export function meshExpressRouter(mesh: MeshInstance, basePath = "/mesh"): Router {
  const router = express.Router();
  const handler = createMeshHttpHandler(mesh);

  async function dispatch(req: Request, res: Response) {
    const result = await handler(
      toHttpRequest({
        method: req.method,
        params: {
          entity: param(req.params.entity),
          id: param(req.params.id),
        },
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body,
      }),
    );

    res.status(result.status).json(result.body);
  }

  router.get(`${basePath}/:entity/:id`, dispatch);
  router.get(`${basePath}/:entity`, dispatch);
  router.post(basePath, dispatch);
  router.put(`${basePath}/:entity/:id`, dispatch);
  router.delete(`${basePath}/:entity/:id`, dispatch);

  return router;
}

/** Express middleware that handles MeshQL routes under a base path. */
export function meshExpressMiddleware(
  mesh: MeshInstance,
  basePath = "/mesh",
): RequestHandler {
  const handler = createMeshHttpHandler(mesh);

  return async function meshExpressMiddleware(
    req: Request,
    res: Response,
    next: (error?: unknown) => void,
  ) {
    if (!req.path.startsWith(basePath)) {
      next();
      return;
    }

    const segments = req.path.slice(basePath.length).split("/").filter(Boolean);
    const entity = segments[0];
    const id = segments[1];

    try {
      const result = await handler(
        toHttpRequest({
          method: req.method,
          params: { entity, id },
          headers: req.headers as Record<string, string | string[] | undefined>,
          body: req.body,
        }),
      );
      res.status(result.status).json(result.body);
    } catch (error) {
      next(error);
    }
  };
}
