/**
 * Hono routes for MeshQL SSE subscriptions.
 */
import type { MeshInstance } from "@meshql/core";
import { toErrorResponse } from "@meshql/http";
import { Hono } from "hono";
import type { Context } from "hono";
import { handleMeshSse, type MeshSseOptions } from "../handler.js";

export interface MeshSseHonoOptions extends MeshSseOptions {
  basePath?: string;
}

function headersFromContext(c: Context): Record<string, string | string[] | undefined> {
  const headers: Record<string, string | string[] | undefined> = {};
  c.req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
}

/** Create Hono routes for MeshQL SSE subscriptions. */
export function meshSseHonoRoutes(
  mesh: MeshInstance,
  options: MeshSseHonoOptions,
): Hono {
  const basePath = options.basePath ?? "/mesh";
  const app = new Hono();

  app.get(`${basePath}/:entity/:id/events`, (c) => {
    const encoder = new TextEncoder();
    let abortHandler: (() => void) | undefined;

    const body = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        try {
          await handleMeshSse(
            mesh,
            {
              method: c.req.method,
              params: {
                entity: c.req.param("entity"),
                id: c.req.param("id"),
              },
              headers: headersFromContext(c),
            },
            {
              write: (chunk) => {
                controller.enqueue(encoder.encode(chunk));
              },
              end: () => {
                controller.close();
              },
              onClose: (callback) => {
                abortHandler = callback;
                c.req.raw.signal.addEventListener("abort", callback, { once: true });
              },
            },
            options,
          );
          controller.close();
        } catch (error) {
          const mapped = toErrorResponse(error);
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify(mapped.body)}\n\n`),
          );
          controller.close();
        }
      },
      cancel() {
        abortHandler?.();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });

  return app;
}
