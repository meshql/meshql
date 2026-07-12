/**
 * Express SSE routes for MeshQL subscriptions.
 */
import type { MeshInstance } from "@meshql/core";
import { toErrorResponse } from "@meshql/http";
import express, { type Request, type Response, type Router } from "express";
import { handleMeshSse, type MeshSseOptions } from "../handler.js";

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
  };
}

/** Mount MeshQL SSE subscription routes alongside query handlers. */
export function meshSseExpressRouter(
  mesh: MeshInstance,
  options: MeshSseOptions,
  basePath = "/mesh",
): Router {
  const router = express.Router();

  router.get(`${basePath}/:entity/:id/events`, async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      await handleMeshSse(
        mesh,
        toHttpRequest(req),
        {
          write: (chunk) => {
            res.write(chunk);
          },
          end: () => {
            res.end();
          },
          onClose: (callback) => {
            req.on("close", callback);
          },
        },
        options,
      );
    } catch (error) {
      const mapped = toErrorResponse(error);
      if (!res.headersSent) {
        res.status(mapped.status).json(mapped.body);
        return;
      }

      res.end();
    }
  });

  return router;
}
