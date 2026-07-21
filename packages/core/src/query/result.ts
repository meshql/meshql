import type { CollectionResult, PageInfo } from "./types.js";
import { buildCursorFromRow } from "./read-cursor.js";
import type { NormalizedReadNode } from "./types.js";

export function emptyPageInfo(): PageInfo {
  return { hasNextPage: false, startCursor: null, endCursor: null };
}

/** Wrap list rows in a collection envelope, trimming the sentinel row. */
export function toCollectionResult<T extends Record<string, unknown>>(
  rows: T[],
  read: NormalizedReadNode | undefined,
): CollectionResult<T> {
  if (!read) {
    return { items: rows, pageInfo: emptyPageInfo() };
  }
  const pageSize = read.page?.first ?? rows.length;
  const hasNextPage = rows.length > pageSize;
  const items = hasNextPage ? rows.slice(0, pageSize) : rows;

  if (items.length === 0) {
    return { items, pageInfo: emptyPageInfo() };
  }

  const startCursor = buildCursorFromRow(read, items[0]!);
  const endCursor = buildCursorFromRow(read, items[items.length - 1]!);

  return {
    items,
    pageInfo: {
      hasNextPage,
      startCursor,
      endCursor,
    },
  };
}
