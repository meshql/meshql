export type PostRow = {
  id: number;
  title?: string;
  body?: string;
  status?: string;
  author?: { name?: string };
  comments?: Array<{ id?: number; body?: string; author?: { name?: string } }>;
};

export type UserRow = {
  id: number;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string;
};

export type StoredAuth = {
  signingToken: string;
  token: string;
  expiresAt: number;
  userId: string;
  role: string;
  name: string;
};

export type WireKind = "query" | "write" | "auth" | "upload" | "sse";

export type WireStatus = "pending" | number | "sse";

export type WireEntry = {
  id: string;
  method: string;
  url: string;
  kind: WireKind;
  startedAt: number;
  durationMs?: number;
  status: WireStatus;
  payload?: unknown;
  response?: unknown;
  error?: string;
  explain: string;
  eventCount?: number;
  live?: boolean;
  /** Raw SSE response stream lines (DevTools-style), not a JSON body. */
  streamText?: string;
};
