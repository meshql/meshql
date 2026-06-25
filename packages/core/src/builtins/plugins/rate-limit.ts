import { RateLimitError } from "../../errors/index.js";
import type { MeshPlugin } from "../../plugin/types.js";
import type { QueryContext } from "../../resolver/context.js";

/** Options for rate limiting. */
export interface RateLimitOptions {
  window: string;
  max: number;
  key?: (ctx: QueryContext) => string;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

function parseWindow(window: string): number {
  const match = window.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) {
    throw new Error(`Invalid rate limit window '${window}'`);
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
    default:
      return value;
  }
}

/** Pluggable backend for rate-limit counters. */
export interface RateLimitStore {
  increment(key: string, windowMs: number): { count: number; resetAt: number };
}

function createMemoryStore(): RateLimitStore {
  const entries = new Map<string, WindowEntry>();

  return {
    increment(key, windowMs) {
      const now = Date.now();
      const existing = entries.get(key);

      if (!existing || now >= existing.resetAt) {
        const entry = { count: 1, resetAt: now + windowMs };
        entries.set(key, entry);
        return entry;
      }

      existing.count += 1;
      return existing;
    },
  };
}

/**
 * Create a rate-limiting plugin.
 *
 * Each plugin instance owns its own in-memory counter map. Two `rateLimit`
 * calls — even with identical `window` / `max` — do **not** share state.
 * For shared state across processes, implement {@link RateLimitStore} and
 * pass it via `store` (slated for a later release).
 */
export function rateLimit(options: RateLimitOptions): MeshPlugin {
  const windowMs = parseWindow(options.window);
  const store = createMemoryStore();

  return {
    name: "rate-limit",

    onRequest(raw, ctx) {
      const keyFn = options.key ?? ((c) => String(c.userId ?? c.ip ?? "anonymous"));
      const rateKey = keyFn(ctx.queryContext);
      const { count, resetAt } = store.increment(rateKey, windowMs);

      if (count > options.max) {
        throw new RateLimitError(
          `Rate limit exceeded: ${options.max} requests per ${options.window}`,
          Math.max(0, resetAt - Date.now()),
        );
      }

      return raw;
    },
  };
}
