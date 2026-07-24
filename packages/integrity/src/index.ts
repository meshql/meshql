/**
 * Request signing and integrity token lifecycle for MeshQL HTTP servers.
 *
 * @module
 * @example
 * ```ts
 * import { createMesh } from "@meshql/core";
 * import { withIntegrity, issueToken } from "@meshql/integrity";
 *
 * const mesh = withIntegrity(createMesh({ entities: {} }), {
 *   secret: "master",
 *   authenticate: async () => ({ userId: "u1", sessionId: "s1" }),
 * });
 * const { token } = issueToken(mesh.integrity, { userId: "u1", sessionId: "s1" });
 * ```
 */
export {
  withIntegrity,
  createIntegrityPlugin,
  issueToken,
  revokeSession,
  injectAuthContext,
} from "./plugin.js";
export type {
  AuthIdentity,
  IntegrityOptions,
  IntegrityConfig,
} from "./plugin.js";

export {
  deriveSigningToken,
  formatWireToken,
  parseWireToken,
  isTokenExpired,
  parseTtl,
  expiresAtFromTtl,
} from "./token.js";
export type { TokenPayload } from "./token.js";

export { InMemoryTokenStore } from "./store.js";
export type { TokenStore, SessionRecord } from "./store.js";

export {
  handleAuth,
  handleLogout,
  createAuthHandler,
} from "./middleware.js";
export type { AuthHttpRequest } from "./middleware.js";

export { createSecureHttpHandler } from "./http.js";
export type { SecureHttpRequest } from "./http.js";
