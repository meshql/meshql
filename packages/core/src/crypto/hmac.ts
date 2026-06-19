import { createHmac, timingSafeEqual } from "node:crypto";

const SIG_PREFIX = "sha256=";

/** Compute HMAC-SHA256 hex digest. */
export function hmacSha256(key: string, data: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

/** Format a signature for the X-Mesh-Signature header. */
export function formatSignature(digest: string): string {
  return `${SIG_PREFIX}${digest}`;
}

/** Parse sha256= prefix from a signature header value. */
export function parseSignature(header: string): string {
  if (header.startsWith(SIG_PREFIX)) {
    return header.slice(SIG_PREFIX.length);
  }
  return header;
}

/** Sign a base64 query header for transport. */
export function signQueryHeader(
  key: string,
  queryHeader: string,
): string {
  return formatSignature(hmacSha256(key, queryHeader));
}

/** Verify a signature against a base64 query header. */
export function verifyQuerySignature(
  key: string,
  queryHeader: string,
  signature: string,
): boolean {
  const expected = hmacSha256(key, queryHeader);
  const received = parseSignature(signature);

  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(received, "utf8"),
  );
}
