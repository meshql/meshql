import type { PostRow } from "./types.js";

export type LiveNotification = {
  id: string;
  at: number;
  title: string;
  detail: string;
  postId: number;
  kind: "comment" | "update" | "status" | "live";
};

const CAP = 30;

export function pushNotification(
  prev: LiveNotification[],
  next: LiveNotification,
): LiveNotification[] {
  return [next, ...prev].slice(0, CAP);
}

/** Diff two post snapshots from SSE into a human-readable activity item. */
export function describePostUpdate(
  prev: PostRow | null,
  next: PostRow,
  postId: number,
): LiveNotification | null {
  const at = Date.now();
  const id = crypto.randomUUID();
  const postLabel = next.title ?? `Post #${postId}`;

  if (!prev) {
    return {
      id,
      at,
      postId,
      kind: "live",
      title: "Live update",
      detail: `${postLabel} refreshed over SSE`,
    };
  }

  const prevComments = prev.comments ?? [];
  const nextComments = next.comments ?? [];
  const prevIds = new Set(prevComments.map((c) => c.id).filter(Boolean));
  const added = nextComments.filter((c) => c.id && !prevIds.has(c.id));

  if (added.length > 0) {
    const comment = added[added.length - 1]!;
    const who = comment.author?.name ?? "Someone";
    const body = (comment.body ?? "").trim();
    return {
      id,
      at,
      postId,
      kind: "comment",
      title: "New comment",
      detail: `${who} on “${postLabel}”${body ? `: ${truncate(body, 80)}` : ""}`,
    };
  }

  if (nextComments.length < prevComments.length) {
    return {
      id,
      at,
      postId,
      kind: "comment",
      title: "Comment removed",
      detail: `A comment was deleted on “${postLabel}”`,
    };
  }

  if (prev.status !== next.status && next.status) {
    return {
      id,
      at,
      postId,
      kind: "status",
      title: "Status changed",
      detail: `“${postLabel}” is now ${next.status}`,
    };
  }

  if (prev.title !== next.title || prev.body !== next.body) {
    return {
      id,
      at,
      postId,
      kind: "update",
      title: "Post updated",
      detail: `“${postLabel}” changed — pushed over SSE`,
    };
  }

  // Same snapshot (e.g. duplicate push) — ignore.
  return null;
}

export function formatNotifyTime(at: number): string {
  const delta = Math.max(0, Date.now() - at);
  if (delta < 5_000) return "just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  return new Date(at).toLocaleTimeString();
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
