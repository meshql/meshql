import {
  IntegrityError,
  verifyQuerySignature,
  type MeshInstance,
  type MeshPlugin,
  type QueryContext,
} from "@meshql/core";
import {
  deriveSigningToken,
  formatWireToken,
  isTokenExpired,
  parseTtl,
  parseWireToken,
  type TokenPayload,
} from "./token.js";
import type { TokenStore } from "./store.js";
import { InMemoryTokenStore } from "./store.js";

/** Authenticated user identity returned from login. */
export interface AuthIdentity {
  userId: string;
  sessionId: string;
  role?: string;
  tenantId?: string;
}

/** Options for full integrity token lifecycle. */
export interface IntegrityOptions {
  secret: string;
  tokenTTL?: string;
  authenticate: (credentials: unknown) => Promise<AuthIdentity>;
  clientSecret?: (clientId: string) => Promise<string | undefined>;
  store?: TokenStore;
}

/** Configuration attached to a mesh instance with integrity enabled. */
export interface IntegrityConfig extends IntegrityOptions {
  store: TokenStore;
  tokenTTL: string;
}

/** Create the integrity verification plugin. */
export function createIntegrityPlugin(config: IntegrityConfig): MeshPlugin {
  return {
    name: "integrity",

    onRequest(raw, ctx) {
      const transport = ctx.transport;
      if (!transport?.queryHeader) {
        throw new IntegrityError("Missing X-Mesh-Query header for verification");
      }

      const wireToken = transport.token;
      if (!wireToken) {
        throw new IntegrityError("Missing X-Mesh-Token header");
      }

      const signature = transport.signature;
      if (!signature) {
        throw new IntegrityError("Missing X-Mesh-Signature header");
      }

      let payload: TokenPayload;
      try {
        payload = parseWireToken(wireToken);
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
        signature,
      );

      if (!valid) {
        throw new IntegrityError("Signature verification failed");
      }

      injectAuthContext(ctx.queryContext, payload);

      return raw;
    },
  };
}

/** Issue a signing token and wire token for an authenticated user. */
export function issueToken(
  config: IntegrityConfig,
  identity: AuthIdentity,
): { signingToken: string; expiresAt: number; token: string } {
  const expiresAt = Date.now() + parseTtl(config.tokenTTL);
  const signingToken = deriveSigningToken(
    config.secret,
    identity.userId,
    identity.sessionId,
    expiresAt,
  );

  const payload: TokenPayload = {
    userId: identity.userId,
    sessionId: identity.sessionId,
    expiresAt,
    role: identity.role,
    tenantId: identity.tenantId,
  };

  const token = formatWireToken(payload);

  config.store.save(identity.sessionId, {
    payload,
    signingToken,
    revoked: false,
  });

  return { signingToken, expiresAt, token };
}

/** Register full integrity token lifecycle on a mesh instance. */
export function withIntegrity(
  mesh: MeshInstance,
  options: IntegrityOptions,
): MeshInstance & { integrity: IntegrityConfig } {
  const config: IntegrityConfig = {
    ...options,
    tokenTTL: options.tokenTTL ?? "15m",
    store: options.store ?? new InMemoryTokenStore(),
  };

  mesh.use(createIntegrityPlugin(config));

  return Object.assign(mesh, { integrity: config });
}

/** Revoke a session token (logout). */
export function revokeSession(config: IntegrityConfig, sessionId: string): void {
  config.store.revoke(sessionId);
}

/** Inject auth context fields into a query context from a token payload. */
export function injectAuthContext(
  ctx: QueryContext,
  payload: TokenPayload,
): void {
  ctx.userId = payload.userId;
  ctx.role = payload.role;
  ctx.tenantId = payload.tenantId;
  ctx.sessionId = payload.sessionId;
}
