import type { MeshInstance } from "@meshql/core";
import { MeshError } from "@meshql/core";
import { decodeQuery, type DecodeQueryOptions } from "../transport/decode.js";

export interface HttpRequest {
  method: string;
  params: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export type HttpHandlerContext = DecodeQueryOptions;

export function handleGet(
  mesh: MeshInstance,
  req: HttpRequest,
  context: HttpHandlerContext = {},
): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const entity = req.params.entity;
  const entityId = req.params.id;
  const { raw, format, transport } = decodeQuery(req, context);

  return mesh.execute(raw, {
    format,
    list: !entityId,
    transport,
    context: {
      requestId: crypto.randomUUID(),
      method: "GET",
      entityId,
      entity,
      ip: getClientIp(req),
    },
  });
}

export async function handlePost(
  mesh: MeshInstance,
  req: HttpRequest,
): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const body = req.body as { query?: string; format?: "json" | "ql" } | undefined;
  const query = body?.query;

  if (!query || typeof query !== "string") {
    throw new MeshError("POST body must include a query string", "TransportError");
  }

  return mesh.execute(query, {
    format: body.format ?? "ql",
    list: true,
    context: {
      requestId: crypto.randomUUID(),
      method: "POST",
      ip: getClientIp(req),
    },
  });
}

export function handlePut(
  mesh: MeshInstance,
  req: HttpRequest,
  context: HttpHandlerContext = {},
): Promise<Record<string, unknown> | Record<string, unknown>[]> {
  const entity = req.params.entity;
  const entityId = req.params.id;
  const { raw, format, transport } = decodeQuery(req, context);

  return mesh.execute(raw, {
    format,
    transport,
    context: {
      requestId: crypto.randomUUID(),
      method: "PUT",
      entityId,
      entity,
      ip: getClientIp(req),
    },
  });
}

function getClientIp(req: HttpRequest): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(",")[0]?.trim();
  }
  return undefined;
}
