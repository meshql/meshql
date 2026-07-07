/** Opaque cursor payload for keyset pagination. */
export interface CursorPayload {
  id: unknown;
}

/** Encode a cursor payload as a URL-safe opaque string. */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/** Decode a cursor string produced by {@link encodeCursor}. */
export function decodeCursor(raw: string): CursorPayload {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new Error("Invalid cursor: not valid base64url");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new Error("Invalid cursor: not valid JSON");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("id" in parsed)
  ) {
    throw new Error("Invalid cursor: missing 'id' field");
  }

  return parsed as CursorPayload;
}
