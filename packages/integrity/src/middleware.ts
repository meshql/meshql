import { MeshError } from "@meshql/core";
import type { IntegrityConfig } from "./plugin.js";
import { issueToken } from "./plugin.js";
import { parseWireToken } from "./token.js";
import { revokeSession } from "./plugin.js";

export interface AuthHttpRequest {
  method: string;
  body?: unknown;
  path?: string;
  headers?: Record<string, string | string[] | undefined>;
}

/** Handle POST /mesh/auth — issue signing token. */
export async function handleAuth(
  config: IntegrityConfig,
  req: AuthHttpRequest,
): Promise<{ signingToken: string; expiresAt: number; token: string }> {
  if (req.method.toUpperCase() !== "POST") {
    throw new MeshError("Method not allowed", "TransportError");
  }

  const identity = await config.authenticate(req.body);
  return issueToken(config, identity);
}

/** Handle POST /mesh/logout — revoke session token. */
export function handleLogout(
  config: IntegrityConfig,
  req: AuthHttpRequest,
): { loggedOut: boolean } {
  const tokenHeader = req.headers?.["x-mesh-token"] ?? req.headers?.["X-Mesh-Token"];
  const wireToken = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

  if (!wireToken) {
    throw new MeshError("Missing X-Mesh-Token header", "TransportError");
  }

  const payload = parseWireToken(wireToken);
  revokeSession(config, payload.sessionId);

  return { loggedOut: true };
}

/** Create an auth handler for framework-agnostic HTTP dispatch. */
export function createAuthHandler(config: IntegrityConfig) {
  return async function authHandler(
    req: AuthHttpRequest,
  ): Promise<{ status: number; body: unknown }> {
    try {
      const path = req.path ?? "/mesh/auth";

      if (path.endsWith("/logout")) {
        return { status: 200, body: handleLogout(config, req) };
      }

      const body = await handleAuth(config, req);
      return { status: 200, body };
    } catch (error) {
      if (error instanceof MeshError) {
        return {
          status: error.code === "TransportError" ? 400 : 401,
          body: { error: error.code, message: error.message, ...error.details },
        };
      }
      throw error;
    }
  };
}
