import { hmacSha256 } from "@meshql/core";

/** Parsed token payload from a wire token. */
export interface TokenPayload {
  userId: string;
  sessionId: string;
  expiresAt: number;
  role?: string;
  tenantId?: string;
}

/** Derive a signing token from the master secret. */
export function deriveSigningToken(
  masterSecret: string,
  userId: string,
  sessionId: string,
  expiresAt: number,
): string {
  return hmacSha256(masterSecret, `${userId}:${sessionId}:${expiresAt}`);
}

/** Encode a token payload into a wire token (tok_...). */
export function formatWireToken(payload: TokenPayload): string {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  return `tok_${encoded}`;
}

/** Parse a wire token into its payload. */
export function parseWireToken(token: string): TokenPayload {
  if (!token.startsWith("tok_")) {
    throw new Error("Invalid token format");
  }

  const encoded = token.slice(4);
  const json = Buffer.from(encoded, "base64url").toString("utf8");
  const payload = JSON.parse(json) as TokenPayload;

  if (!payload.userId || !payload.sessionId || !payload.expiresAt) {
    throw new Error("Invalid token payload");
  }

  return payload;
}

/** Check if a token has expired. */
export function isTokenExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

/** Parse a TTL string (e.g. 15m, 1h) into milliseconds. */
export function parseTtl(ttl: string): number {
  const match = ttl.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid TTL '${ttl}'`);
  }

  const value = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return value;
  }
}

/** Compute expiry timestamp from a TTL string. */
export function expiresAtFromTtl(ttl: string): number {
  return Date.now() + parseTtl(ttl);
}
