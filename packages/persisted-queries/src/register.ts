import { createHash } from "node:crypto";
import type { QueryFormat } from "@meshql/http";
import { contentKey, type QueryStore } from "./store.js";

const ID_PREFIX = "q_";
const ID_HEX_LENGTH = 8;

function hashContent(raw: string, format: QueryFormat): string {
  return createHash("sha256").update(format).update("\0").update(raw).digest("hex");
}

/** Create a short content-addressed query ID (`q_a3f1b2c8`). */
export function createQueryId(raw: string, format: QueryFormat): string {
  return `${ID_PREFIX}${hashContent(raw, format).slice(0, ID_HEX_LENGTH)}`;
}

function createUniqueId(
  raw: string,
  format: QueryFormat,
  store: QueryStore,
  hexLength = ID_HEX_LENGTH,
): string {
  const digest = hashContent(raw, format);
  let length = hexLength;

  while (length <= digest.length) {
    const id = `${ID_PREFIX}${digest.slice(0, length)}`;
    const existing = store.get(id);
    if (!existing) {
      return id;
    }

    if (existing.raw === raw && existing.format === format) {
      return id;
    }

    length += 2;
  }

  throw new Error("Unable to allocate a unique persisted query ID");
}

/** Register a query and return its persisted ID. Reuses IDs for identical content. */
export function registerQuery(
  store: QueryStore,
  raw: string,
  format: QueryFormat = "json",
): string {
  const existingId = store.findByContent(raw, format);
  if (existingId) {
    return existingId;
  }

  const id = createUniqueId(raw, format, store);
  store.save(id, {
    raw,
    format,
    createdAt: Date.now(),
  });
  return id;
}

export function isQueryId(value: string): boolean {
  return value.startsWith(ID_PREFIX) && value.length > ID_PREFIX.length;
}

export { contentKey };
