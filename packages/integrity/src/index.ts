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
