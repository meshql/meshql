import type { ExecuteTransport } from "../plugin/types.js";
import type { QueryContext } from "../resolver/context.js";

/** Options for optional SQL tracing during execute. */
export interface ExecuteTraceOptions {
  /** When true, resolvers may record SQL on the join plan. */
  sql?: boolean;
}

/** Options passed to {@link MeshInstance.execute}. */
export interface ExecuteOptions {
  /** Query wire format. Defaults to `json`. */
  format?: "json" | "ql";
  /** Request context passed to resolvers. */
  context?: Partial<QueryContext> & Pick<QueryContext, "requestId" | "method">;
  /** Return a list of shaped records instead of a single object. */
  list?: boolean;
  /** HTTP transport metadata for integrity verification. */
  transport?: ExecuteTransport;
  /** Optional resolver tracing (e.g. SQL capture for docs playground). */
  trace?: ExecuteTraceOptions;
}
