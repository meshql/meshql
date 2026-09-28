import { createClient, type MeshClient } from "@meshql/client";
import type { SqlStatement, StoredAuth } from "./types.js";
import { MESH_URL } from "./utils.js";

const TRACE_HEADER = "X-Showcase-Trace";

/** One-shot client whose fetch reports the server's SQL trace id for this call. */
export function tracedClient(
  auth: Pick<StoredAuth, "signingToken" | "token">,
  onTrace: (traceId: string) => void,
): MeshClient {
  return createClient({
    url: MESH_URL,
    format: "json",
    signingToken: auth.signingToken,
    token: auth.token,
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      const traceId = response.headers.get(TRACE_HEADER);
      if (traceId) onTrace(traceId);
      return response;
    },
  });
}

/** Load executed statements for a trace id; `null` when tracing is unavailable. */
export async function loadSqlTrace(traceId: string | undefined): Promise<SqlStatement[] | null> {
  if (!traceId) return null;
  try {
    const response = await fetch(`/showcase/sql/${encodeURIComponent(traceId)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { sql?: SqlStatement[] };
    return body.sql ?? null;
  } catch {
    return null;
  }
}
