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

function getHeader(
  headers: HeaderCarrier["headers"],
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/** Read transport headers without decoding the query body. */
export function readTransportHeaders(req: HeaderCarrier): ExecuteTransport {
  const queryHeader = getHeader(req.headers, "x-mesh-query");
  if (!queryHeader) {
    throw new TransportError("Missing X-Mesh-Query header");
  }

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

/** Decode a MeshQL query from `X-Mesh-Query` transport headers. */
export function decodeQuery(req: HeaderCarrier): DecodedQuery {
  const transport = readTransportHeaders(req);
  const format = (getHeader(req.headers, "x-mesh-format") ?? "json") as QueryFormat;
  const version = getHeader(req.headers, "x-mesh-version");

  if (version && version !== "1") {
    throw new TransportError(`Unsupported X-Mesh-Version '${version}'`);
  }

  if (format !== "json" && format !== "ql") {
    throw new TransportError(`Unknown X-Mesh-Format '${format}' - use json or ql`);
  }

  try {
    const raw = Buffer.from(transport.queryHeader, "base64").toString("utf8");
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
