import { IntegrityError, verifyQuerySignature } from "@meshql/core";
import { decodeQuery } from "@meshql/http";
import {
  deriveSigningToken,
  isTokenExpired,
  parseWireToken,
  type IntegrityConfig,
} from "@meshql/integrity";
import type { Request } from "express";
import type { AuthContext } from "./auth-context.js";

/** Verify signed MeshQL transport headers and return the caller identity. */
export function verifyMeshRequest(
  req: Request,
  config: IntegrityConfig,
): AuthContext {
  const { transport } = decodeQuery({
    headers: req.headers as Record<string, string | string[] | undefined>,
  });

  if (!transport.token) {
    throw new IntegrityError("Missing X-Mesh-Token header");
  }
  if (!transport.signature) {
    throw new IntegrityError("Missing X-Mesh-Signature header");
  }

  let payload;
  try {
    payload = parseWireToken(transport.token);
  } catch {
    throw new IntegrityError("Unknown or invalid token");
  }

  if (isTokenExpired(payload.expiresAt)) {
    throw new IntegrityError("Signing token expired", { code: "TOKEN_EXPIRED" });
  }

  if (config.store.isRevoked(payload.sessionId)) {
    throw new IntegrityError("Unknown or invalid token");
  }

  const session = config.store.get(payload.sessionId);
  const signingToken =
    session?.signingToken ??
    deriveSigningToken(
      config.secret,
      payload.userId,
      payload.sessionId,
      payload.expiresAt,
    );

  const valid = verifyQuerySignature(
    signingToken,
    transport.queryHeader,
    transport.signature,
  );

  if (!valid) {
    throw new IntegrityError("Signature verification failed");
  }

  return {
    userId: payload.userId,
    role: payload.role ?? "guest",
  };
}
