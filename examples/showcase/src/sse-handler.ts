import { toErrorResponse } from "@meshql/http";
import { handleMeshSse } from "@meshql/sse";
import type { Express } from "express";
import { mesh } from "./mesh.js";
import { pubsub } from "./pubsub.js";

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Signed SSE route — integrity runs via the mesh integrity plugin on each refresh. */
export function mountSseRoute(app: Express, basePath = "/mesh"): void {
  app.get(`${basePath}/:entity/:id/events`, async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      await handleMeshSse(
        mesh,
        {
          method: req.method,
          params: {
            entity: param(req.params.entity),
            id: param(req.params.id),
          },
          headers: req.headers as Record<string, string | string[] | undefined>,
        },
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
        { pubsub },
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
}
