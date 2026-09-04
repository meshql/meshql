import type { MeshQuery } from "@meshql/client";
import type { WireEntry, WireStatus } from "./types.js";

export const WIRE_CAP = 50;

export function newWireId(): string {
  return crypto.randomUUID();
}

export function displayPath(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }
  return url;
}

export function explainAuth(): string {
  return "Signed in via integrity auth (`POST /mesh/auth`).";
}

export function explainQuery(query: MeshQuery, entityId?: string): string {
  const root = Object.keys(query)[0] ?? "entity";
  const node = query[root] as unknown as
    | { $page?: unknown; $orderBy?: unknown }
    | undefined;
  const hasPage = Boolean(node && "$page" in node);
  const hasOrder = Boolean(node && "$orderBy" in node);

  if (root === "post" && !entityId && (hasPage || hasOrder)) {
    return "Collection read with `$page` + `$orderBy` and nested `author` / `comments`.";
  }
  if (root === "post" && entityId) {
    return `Point read for post ${entityId} with nested \`author\` and \`comments\`.`;
  }
  if (root === "user") {
    return "Point read for the signed-in user. Field access may hide `email` unless you are an admin.";
  }
  if (entityId) {
    return `Point read: GET /mesh/${root}/${entityId} with the selected fields.`;
  }
  const extras = [hasPage ? "`$page`" : null, hasOrder ? "`$orderBy`" : null]
    .filter(Boolean)
    .join(" + ");
  return extras
    ? `Collection read of \`${root}\` with ${extras}.`
    : `Collection read of \`${root}\`.`;
}

export function explainWrite(
  op: string,
  entity: string,
  id?: number | string,
): string {
  if (op === "create") {
    return `REST create \`${entity}\` — \`POST /mesh/${entity}\`.`;
  }
  if (op === "update") {
    return `REST update \`${entity}\` — \`PATCH /mesh/${entity}/${id}\`.`;
  }
  return `REST delete \`${entity}\` — \`DELETE /mesh/${entity}/${id}\`.`;
}

export function explainUpload(): string {
  return "Multipart upload for `user.avatar` via `client.upload()`.";
}

export function explainSse(entity: string, entityId: string): string {
  return `One long-lived GET (type: eventsource). Connect acks with event: initialize (pong). Record payloads only arrive later as event: update when the record changes.`;
}

export function formatSseFrame(
  data: unknown,
  event: "update" | "initialize" = "update",
): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function formatDuration(ms?: number): string {
  if (ms === undefined) return "…";
  if (ms < 1000) return `${Math.max(0, ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatStatus(status: WireStatus): string {
  if (status === "pending") return "pending";
  if (status === "sse") return "200";
  return String(status);
}

export function lastCallLabel(entry: WireEntry | undefined): string {
  if (!entry) return "No MeshQL calls yet";
  const path = displayPath(entry.url);
  if (entry.status === "pending") return `${entry.method} ${path}  pending`;
  if (entry.status === "sse") {
    const n = entry.eventCount ?? 0;
    return `${entry.method} ${path}  ${n} event${n === 1 ? "" : "s"}`;
  }
  return `${entry.method} ${path}  ${formatDuration(entry.durationMs)}`;
}
