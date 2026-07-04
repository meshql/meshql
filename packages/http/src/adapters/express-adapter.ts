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
import express, {
  type Request,
  type RequestHandler,
  type Response,
  type Router,
} from "express";
import { handleUpload } from "../handlers/upload.js";
import { toErrorResponse } from "../index.js";
import { createMeshHttpHandler, toHttpRequest } from "./shared.js";

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Options for Express MeshQL routes. */
export interface MeshExpressOptions {
  /** Max multipart upload size in bytes. Default 25 MiB. */
  maxUploadBytes?: number;
}

/** Mount MeshQL routes on an Express router. */
export function meshExpressRouter(
  mesh: MeshInstance,
  basePath = "/mesh",
  options: MeshExpressOptions = {},
): Router {
  const router = express.Router();
  const handler = createMeshHttpHandler(mesh);
  const maxBytes = options.maxUploadBytes;

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

  async function upload(req: Request, res: Response) {
    try {
      const body = await handleUpload(mesh, {
        method: req.method,
        params: {
          entity: param(req.params.entity),
          id: param(req.params.id),
          field: param(req.params.field),
        },
        headers: req.headers as Record<string, string | string[] | undefined>,
        stream: req,
        maxBytes,
      });
      res.status(200).json(body);
    } catch (error) {
      const mapped = toErrorResponse(error);
      res.status(mapped.status).json(mapped.body);
    }
  }

  // Upload routes must be registered before the generic POST /:entity query path.
  router.post(`${basePath}/:entity/:id/:field`, upload);
  router.post(`${basePath}/:entity`, upload);

  router.get(`${basePath}/:entity/:id`, dispatch);
  router.get(`${basePath}/:entity`, dispatch);
  router.post(basePath, dispatch);
  router.put(`${basePath}/:entity/:id`, dispatch);

  return router;
}

/** Express middleware that handles MeshQL routes under a base path. */
export function meshExpressMiddleware(
  mesh: MeshInstance,
  basePath = "/mesh",
  options: MeshExpressOptions = {},
): RequestHandler {
  const handler = createMeshHttpHandler(mesh);
  const maxBytes = options.maxUploadBytes;

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
    const field = segments[2];

    try {
      if (req.method === "POST" && entity && (field || !id)) {
        // POST /:entity/:id/:field or POST /:entity (upload create)
        if (field || segments.length === 1) {
          const body = await handleUpload(mesh, {
            method: req.method,
            params: { entity, id: field ? id : undefined, field },
            headers: req.headers as Record<string, string | string[] | undefined>,
            stream: req,
            maxBytes,
          });
          res.status(200).json(body);
          return;
        }
      }

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
