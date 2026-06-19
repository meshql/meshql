import type { MeshInstance } from "@meshql/core";
import {
  createHttpHandler,
  type HttpRequest,
} from "@meshql/http";
import type { IntegrityConfig } from "./plugin.js";
import { createAuthHandler } from "./middleware.js";

export interface SecureHttpRequest extends HttpRequest {
  path?: string;
}

/** Create an HTTP handler with query dispatch and auth routes. */
export function createSecureHttpHandler(
  mesh: MeshInstance,
  config: IntegrityConfig,
): (req: SecureHttpRequest) => Promise<{ status: number; body: unknown }> {
  const queryHandler = createHttpHandler(mesh);
  const authHandler = createAuthHandler(config);

  return async function secureHttpHandler(req: SecureHttpRequest) {
    const path = req.path ?? "";
    const method = req.method.toUpperCase();

    if (path.endsWith("/auth") && method === "POST") {
      return authHandler({ method: req.method, body: req.body, headers: req.headers, path });
    }

    if (path.endsWith("/logout") && method === "POST") {
      return authHandler({ method: req.method, body: req.body, headers: req.headers, path });
    }

    return queryHandler(req);
  };
}
