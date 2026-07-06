/** Web-safe query transport signing (browser + Node fetch clients). */

export type QueryFormat = "json" | "ql";

export interface SignQueryOptions {
  secret?: string;
  signingToken?: string;
  token?: string;
  format?: QueryFormat;
}

const SIG_PREFIX = "sha256=";

/** Base64-encode a UTF-8 string without Node `Buffer`. */
export function encodeQuery(
  query: string,
  format: QueryFormat = "json",
): Record<string, string> {
  const bytes = new TextEncoder().encode(query);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return {
    "X-Mesh-Query": btoa(binary),
    "X-Mesh-Format": format,
    "X-Mesh-Version": "1",
  };
}

function bufferToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return bufferToHex(new Uint8Array(sig));
}

/** Encode and sign a MeshQL query for HTTP transport. */
export async function signQuery(
  query: string,
  options: SignQueryOptions = {},
): Promise<Record<string, string>> {
  const format = options.format ?? "json";
  const headers = encodeQuery(query, format);
  const key = options.signingToken ?? options.secret;

  if (key) {
    const digest = await hmacSha256(key, headers["X-Mesh-Query"]!);
    headers["X-Mesh-Signature"] = `${SIG_PREFIX}${digest}`;
  }

  if (options.token) {
    headers["X-Mesh-Token"] = options.token;
  }

  return headers;
}
