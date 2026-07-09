import { signQueryHeader, type ExecuteTransport } from "@meshql/core";
import { TransportError } from "@meshql/core";

/** Supported MeshQL query transport formats. */
export type QueryFormat = "json" | "ql";

/** Decoded query payload from HTTP headers. */
export interface DecodedQuery {
  raw: string;
  format: QueryFormat;
  transport: ExecuteTransport;
}

/** Object carrying HTTP headers for query decoding. */
export interface HeaderCarrier {
  headers: Record<string, string | string[] | undefined>;
}

/** Resolved persisted query payload. */
export interface ResolvedQueryId {
  raw: string;
  format?: QueryFormat;
}

/** Options for {@link decodeQuery}. */
export interface DecodeQueryOptions {
  /** Resolve a persisted query ID to its stored wire payload. */
  resolveQueryId?: (id: string) => ResolvedQueryId | undefined;
}

function getHeader(
  headers: HeaderCarrier["headers"],
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  const direct = headers[name] ?? headers[lower];
  if (direct !== undefined) {
    return Array.isArray(direct) ? direct[0] : direct;
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower || value === undefined) {
      continue;
    }
    return Array.isArray(value) ? value[0] : value;
  }

  return undefined;
}

function readQueryTransport(req: HeaderCarrier): {
  queryHeader: string;
  queryId?: string;
} {
  const queryId = getHeader(req.headers, "x-mesh-query-id");
  const queryHeader = getHeader(req.headers, "x-mesh-query");

  if (queryId && queryHeader) {
    throw new TransportError(
      "X-Mesh-Query and X-Mesh-Query-Id are mutually exclusive",
    );
  }

  if (!queryId && !queryHeader) {
    throw new TransportError("Missing X-Mesh-Query or X-Mesh-Query-Id header");
  }

  return {
    queryHeader: queryId ?? queryHeader!,
    queryId,
  };
}

/** Read transport headers without decoding the query body. */
export function readTransportHeaders(req: HeaderCarrier): ExecuteTransport {
  const { queryHeader } = readQueryTransport(req);

  return {
    queryHeader,
    signature: getHeader(req.headers, "x-mesh-signature"),
    token: getHeader(req.headers, "x-mesh-token"),
    headers: Object.fromEntries(
      Object.entries(req.headers).flatMap(([key, value]) => {
        if (value === undefined) {
          return [];
        }
        const normalized = Array.isArray(value) ? value[0] : value;
        return normalized !== undefined ? [[key.toLowerCase(), normalized]] : [];
      }),
    ),
  };
}

/** Decode a MeshQL query from transport headers. */
export function decodeQuery(
  req: HeaderCarrier,
  options: DecodeQueryOptions = {},
): DecodedQuery {
  const { queryHeader, queryId } = readQueryTransport(req);
  const transport = readTransportHeaders(req);
  const format = (getHeader(req.headers, "x-mesh-format") ?? "json") as QueryFormat;
  const version = getHeader(req.headers, "x-mesh-version");

  if (version && version !== "1") {
    throw new TransportError(`Unsupported X-Mesh-Version '${version}'`);
  }

  if (format !== "json" && format !== "ql") {
    throw new TransportError(`Unknown X-Mesh-Format '${format}' - use json or ql`);
  }

  if (queryId) {
    const resolved = options.resolveQueryId?.(queryId);
    if (!resolved) {
      throw new TransportError(`Unknown X-Mesh-Query-Id '${queryId}'`);
    }

    return {
      raw: resolved.raw,
      format: resolved.format ?? format,
      transport,
    };
  }

  try {
    const raw = Buffer.from(queryHeader, "base64").toString("utf8");
    return { raw, format, transport };
  } catch {
    throw new TransportError("Invalid X-Mesh-Query encoding - must be base64");
  }
}

/** Encode a MeshQL query into transport headers for HTTP requests. */
export function encodeQuery(
  query: string,
  format: QueryFormat = "json",
): Record<string, string> {
  return {
    "X-Mesh-Query": Buffer.from(query, "utf8").toString("base64"),
    "X-Mesh-Format": format,
    "X-Mesh-Version": "1",
  };
}

/** Encode a persisted query ID into transport headers. */
export function encodePersistedQuery(
  queryId: string,
  format: QueryFormat = "json",
): Record<string, string> {
  return {
    "X-Mesh-Query-Id": queryId,
    "X-Mesh-Format": format,
    "X-Mesh-Version": "1",
  };
}

/** Options for signing encoded query headers. */
export interface SignQueryOptions {
  secret?: string;
  signingToken?: string;
  token?: string;
}

/** Encode and sign a MeshQL query for HTTP transport. */
export function signQuery(
  query: string,
  options: SignQueryOptions & { format?: QueryFormat } = {},
): Record<string, string> {
  const format = options.format ?? "json";
  const headers = encodeQuery(query, format);
  const key = options.signingToken ?? options.secret;

  if (key) {
    headers["X-Mesh-Signature"] = signQueryHeader(key, headers["X-Mesh-Query"]!);
  }

  if (options.token) {
    headers["X-Mesh-Token"] = options.token;
  }

  return headers;
}

/** Encode and sign a persisted query ID for HTTP transport. */
export function signPersistedQuery(
  queryId: string,
  options: SignQueryOptions & { format?: QueryFormat } = {},
): Record<string, string> {
  const format = options.format ?? "json";
  const headers = encodePersistedQuery(queryId, format);
  const key = options.signingToken ?? options.secret;

  if (key) {
    headers["X-Mesh-Signature"] = signQueryHeader(key, headers["X-Mesh-Query-Id"]!);
  }

  if (options.token) {
    headers["X-Mesh-Token"] = options.token;
  }

  return headers;
}
