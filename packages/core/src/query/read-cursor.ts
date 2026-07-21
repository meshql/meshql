import { ValidationError } from "../errors/index.js";
import { queryScopeFingerprint } from "./normalize.js";
import type { NormalizedReadNode, SortExpr } from "./types.js";

/** Versioned payload encoded inside an opaque MeshQL cursor. */
export interface ReadCursorPayload {
  v: 2;
  entity: string;
  path: string;
  order: Array<{
    field: string;
    direction: "asc" | "desc";
    nulls: "first" | "last";
  }>;
  values: unknown[];
  scope: string;
}

export function encodeReadCursor(payload: ReadCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeReadCursor(raw: string): ReadCursorPayload {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    throw new ValidationError("Invalid cursor: not valid base64url");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    throw new ValidationError("Invalid cursor: not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError("Invalid cursor payload");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.v !== 2) {
    throw new ValidationError("Invalid cursor version");
  }
  if (typeof obj.entity !== "string" || typeof obj.path !== "string") {
    throw new ValidationError("Invalid cursor: missing entity/path");
  }
  if (
    !Array.isArray(obj.order) ||
    !Array.isArray(obj.values) ||
    typeof obj.scope !== "string"
  ) {
    throw new ValidationError("Invalid cursor: missing order/values/scope");
  }
  return obj as unknown as ReadCursorPayload;
}

export function assertCursorMatchesRead(
  cursor: ReadCursorPayload,
  read: NormalizedReadNode,
): void {
  const scope = queryScopeFingerprint(read);
  if (
    cursor.entity !== read.entityKey ||
    cursor.path !== read.path ||
    cursor.scope !== scope
  ) {
    throw new ValidationError("Cursor does not match query scope");
  }
  const order = normalizeOrderForCursor(read.orderBy);
  if (cursor.order.length !== order.length) {
    throw new ValidationError("Cursor order mismatch");
  }
  for (let i = 0; i < order.length; i++) {
    const a = cursor.order[i]!;
    const b = order[i]!;
    if (
      a.field !== b.field ||
      a.direction !== b.direction ||
      a.nulls !== b.nulls
    ) {
      throw new ValidationError("Cursor order mismatch");
    }
  }
}

export function normalizeOrderForCursor(
  orderBy: SortExpr[],
): Array<{
  field: string;
  direction: "asc" | "desc";
  nulls: "first" | "last";
}> {
  return orderBy
    .filter(
      (entry): entry is Extract<SortExpr, { field: string }> => "field" in entry,
    )
    .map((entry) => ({
      field: entry.field,
      direction: entry.direction,
      nulls: entry.nulls ?? "last",
    }));
}

export function buildCursorFromRow(
  read: NormalizedReadNode,
  row: Record<string, unknown>,
): string {
  const order = normalizeOrderForCursor(read.orderBy);
  const values = order.map((entry) => row[entry.field]);
  return encodeReadCursor({
    v: 2,
    entity: read.entityKey,
    path: read.path,
    order,
    values,
    scope: queryScopeFingerprint(read),
  });
}
