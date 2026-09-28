import { AsyncLocalStorage } from "node:async_hooks";
import type { SqlTraceEntry } from "@meshql/core";
import type { Express } from "express";

/**
 * Demo-only SQL inspector for the network sheet. Real apps should not expose
 * executed SQL from their public API; keep this behind a flag like the one here.
 */
export const SQL_TRACE_ENABLED = !["0", "false", "off"].includes(
  (process.env.SHOWCASE_SQL_TRACE ?? "").toLowerCase(),
);

export const TRACE_HEADER = "X-Showcase-Trace";

const TRACE_CAP = 200;

const storage = new AsyncLocalStorage<SqlTraceEntry[]>();
const traces = new Map<string, SqlTraceEntry[]>();

/** Record a statement against the current `/mesh` request, if traced. */
export function recordShowcaseSql(entry: SqlTraceEntry): void {
  storage.getStore()?.push({
    sql: entry.sql,
    params: entry.params.map(jsonSafeParam),
  });
}

function jsonSafeParam(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `<${value.byteLength} bytes>`;
  return value;
}

/** Trace `/mesh` reads and serve captured SQL at `GET /showcase/sql/:id`. */
export function mountSqlTrace(app: Express, basePath = "/mesh"): void {
  if (!SQL_TRACE_ENABLED) return;

  app.get(`${basePath}/*path`, (req, res, next) => {
    if (req.path.endsWith("/events")) {
      next();
      return;
    }
    const id = crypto.randomUUID();
    const entries: SqlTraceEntry[] = [];
    traces.set(id, entries);
    while (traces.size > TRACE_CAP) {
      const oldest = traces.keys().next().value;
      if (oldest === undefined) break;
      traces.delete(oldest);
    }
    res.setHeader(TRACE_HEADER, id);
    storage.run(entries, () => next());
  });

  app.get("/showcase/sql/:id", (req, res) => {
    const entries = traces.get(req.params.id);
    if (!entries) {
      res.status(404).json({ error: "NotFound", message: "Unknown trace id" });
      return;
    }
    res.json({ sql: entries });
  });
}
