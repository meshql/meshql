import type { MeshInstance } from "@meshql/core";
import { TransportError } from "@meshql/core";
import type { Readable } from "node:stream";
import { decodeQuery } from "../transport/decode.js";
import { parseMultipart } from "../transport/multipart.js";

/** HTTP request shape for upload handling. */
export interface UploadHttpRequest {
  method: string;
  params: Record<string, string | undefined>;
  headers: Record<string, string | string[] | undefined>;
  /** Raw request stream (multipart body). */
  stream: Readable;
  /** Max upload bytes; defaults to 25 MiB. */
  maxBytes?: number;
}

/** Pull the upload field name from a signed wire payload. */
export function extractUploadField(raw: string, entity: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const selection = parsed[entity];
    if (!selection || typeof selection !== "object" || Array.isArray(selection)) {
      return undefined;
    }
    for (const [key, value] of Object.entries(selection as Record<string, unknown>)) {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        (value as { upload?: unknown }).upload === true
      ) {
        return key;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/** Handle a multipart upload request. */
export async function handleUpload(
  mesh: MeshInstance,
  req: UploadHttpRequest,
): Promise<Record<string, unknown>> {
  const entity = req.params.entity;
  if (!entity) {
    throw new TransportError("Upload requires an entity path segment");
  }

  const { raw, transport } = decodeQuery(req);
  const field = req.params.field ?? extractUploadField(raw, entity);
  if (!field) {
    throw new TransportError(
      "Upload requires a field path segment or `{ upload: true }` in X-Mesh-Query",
    );
  }

  const { file, meta } = await parseMultipart(req.stream, {
    headers: req.headers,
    maxBytes: req.maxBytes,
  });

  return mesh.executeUpload({
    entity,
    field,
    entityId: req.params.id,
    file,
    query: raw,
    transport,
    context: {
      requestId: crypto.randomUUID(),
      method: "POST",
      entity,
      entityId: req.params.id,
      ...(meta ?? {}),
    },
  });
}
