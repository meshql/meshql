import type { MeshInstance } from "@meshql/core";
import { MeshError } from "@meshql/core";
import { decodeQuery } from "../transport/decode.js";

export interface HttpRequest {
  method: string;
  params: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export function handleGet(mesh: MeshInstance, req: HttpRequest) {
  const entity = req.params.entity;
  const entityId = req.params.id;
  const { raw, format } = decodeQuery(req);

  return mesh.execute(raw, {
    format,
    list: !entityId,
    context: {
      requestId: crypto.randomUUID(),
      method: "GET",
      entityId,
      entity,
    },
  });
}

export async function handlePost(mesh: MeshInstance, req: HttpRequest) {
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
    },
  });
}

export function handlePut(mesh: MeshInstance, req: HttpRequest) {
  const entity = req.params.entity;
  const entityId = req.params.id;
  const { raw, format } = decodeQuery(req);

  return mesh.execute(raw, {
    format,
    context: {
      requestId: crypto.randomUUID(),
      method: "PUT",
      entityId,
      entity,
    },
  });
}

export function handleDelete(_mesh: MeshInstance, req: HttpRequest) {
  const entity = req.params.entity;
  const entityId = req.params.id;

  return {
    deleted: true,
    entity,
    id: entityId,
  };
}
