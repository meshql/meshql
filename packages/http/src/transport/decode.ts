import { TransportError } from "@meshql/core";

/** Supported MeshQL query transport formats. */
export type QueryFormat = "json" | "ql";

/** Decoded query payload from HTTP headers. */
export interface DecodedQuery {
  raw: string;
  format: QueryFormat;
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

/** Decode a MeshQL query from `X-Mesh-Query` transport headers. */
export function decodeQuery(req: HeaderCarrier): DecodedQuery {
  const header = getHeader(req.headers, "x-mesh-query");
  const format = (getHeader(req.headers, "x-mesh-format") ?? "json") as QueryFormat;
  const version = getHeader(req.headers, "x-mesh-version");

  if (version && version !== "1") {
    throw new TransportError(`Unsupported X-Mesh-Version '${version}'`);
  }

  if (!header) {
    throw new TransportError("Missing X-Mesh-Query header");
  }

  if (format !== "json" && format !== "ql") {
    throw new TransportError(`Unknown X-Mesh-Format '${format}' - use json or ql`);
  }

  try {
    const raw = Buffer.from(header, "base64").toString("utf8");
    return { raw, format };
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
