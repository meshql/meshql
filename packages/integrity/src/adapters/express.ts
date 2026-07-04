/**
 * Express router with integrity auth routes for MeshQL.
 */
import type { MeshInstance } from "@meshql/core";
import express, { type Request, type Response, type Router } from "express";
import { handleUpload, toErrorResponse } from "@meshql/http";
import type { IntegrityConfig } from "../plugin.js";
import { createSecureHttpHandler } from "../http.js";

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

/** Options for integrity Express routes. */
export interface MeshIntegrityExpressOptions {
  maxUploadBytes?: number;
}

/** Mount MeshQL routes with POST /mesh/auth and /mesh/logout. */
export function meshIntegrityExpressRouter(
  mesh: MeshInstance,
  config: IntegrityConfig,
  basePath = "/mesh",
  options: MeshIntegrityExpressOptions = {},
): Router {
  const router = express.Router();
  const handler = createSecureHttpHandler(mesh, config);
  const maxBytes = options.maxUploadBytes;

  async function dispatch(req: Request, res: Response) {
    const result = await handler(toHttpRequest(req));
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

  router.post(`${basePath}/auth`, dispatch);
  router.post(`${basePath}/logout`, dispatch);
  router.post(`${basePath}/:entity/:id/:field`, upload);
  router.post(`${basePath}/:entity`, upload);
  router.get(`${basePath}/:entity/:id`, dispatch);
  router.get(`${basePath}/:entity`, dispatch);
  router.post(basePath, dispatch);
  router.put(`${basePath}/:entity/:id`, dispatch);
  router.delete(`${basePath}/:entity/:id`, dispatch);

  return router;
}
