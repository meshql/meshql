import type { MeshInstance } from "@meshql/core";
import { toErrorResponse } from "@meshql/http";
import {
  defaultDocsConfig,
  isDocsAuthAllowed,
  shouldTraceSql,
  type DocsConfig,
} from "./options.js";

export interface DocsExecuteBody {
  query: string;
  format?: "json" | "ql";
  context?: Record<string, unknown>;
}

function queryContextFromBody(
  body: DocsExecuteBody,
  requestId: string,
): {
  requestId: string;
  method: "GET";
} & Record<string, unknown> {
  const base = {
    requestId,
    method: "GET" as const,
  };
  if (!body.context || typeof body.context !== "object") {
    return base;
  }
  return { ...base, ...body.context };
}

/** Run a MeshQL query for the docs playground execute proxy. */
export async function executeDocsQuery(
  mesh: MeshInstance,
  config: DocsConfig,
  body: DocsExecuteBody,
): Promise<{ status: number; body: unknown }> {
  const resolved = defaultDocsConfig(config);

  if (!body.query || typeof body.query !== "string") {
    return {
      status: 400,
      body: { error: "ValidationError", message: "query is required" },
    };
  }

  const ctx = queryContextFromBody(body, crypto.randomUUID());

  if (!isDocsAuthAllowed(resolved.auth, ctx)) {
    return {
      status: 403,
      body: { error: "Forbidden", message: "Docs access denied" },
    };
  }

  try {
    const traceSql = shouldTraceSql(resolved);
    const result = await mesh.executeDetailed(body.query, {
      format: body.format ?? "json",
      context: ctx,
      trace: traceSql ? { sql: true } : undefined,
    });

    const response: Record<string, unknown> = {
      data: result.data,
      meta: {
        durationMs: result.meta.durationMs,
        plan: result.meta.plan,
        version: result.meta.version,
      },
    };

    if (result.meta.sql && result.meta.sql.length > 0) {
      response.meta = {
        ...(response.meta as Record<string, unknown>),
        sql: result.meta.sql,
      };
    }

    return { status: 200, body: response };
  } catch (error) {
    const err = toErrorResponse(error);
    return err;
  }
}
