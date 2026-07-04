import { TransportError, type MeshFile } from "@meshql/core";
import Busboy from "busboy";
import type { Readable } from "node:stream";

/** Options for multipart parsing. */
export interface ParseMultipartOptions {
  /** Max total file bytes. Default 25 MiB. */
  maxBytes?: number;
  headers: Record<string, string | string[] | undefined>;
}

/** Result of parsing a multipart upload body. */
export interface ParsedMultipart {
  file: MeshFile;
  /** Optional JSON metadata from a part named `meta`. */
  meta?: Record<string, unknown>;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Stream-parse `multipart/form-data` into a single file and optional `meta` JSON.
 *
 * Rejects when `Content-Length` exceeds `maxBytes` (default 25 MiB) or when
 * the accumulated file size exceeds the limit during streaming.
 */
export function parseMultipart(
  stream: Readable,
  options: ParseMultipartOptions,
): Promise<ParsedMultipart> {
  const maxBytes = options.maxBytes ?? 25 * 1024 * 1024;
  const contentLength = headerValue(options.headers, "content-length");
  if (contentLength) {
    const length = Number(contentLength);
    if (Number.isFinite(length) && length > maxBytes) {
      return Promise.reject(
        new TransportError(`Upload exceeds maximum size of ${maxBytes} bytes`),
      );
    }
  }

  const contentType = headerValue(options.headers, "content-type");
  if (!contentType?.includes("multipart/form-data")) {
    return Promise.reject(
      new TransportError("Upload requires Content-Type: multipart/form-data"),
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let file: MeshFile | undefined;
    let meta: Record<string, unknown> | undefined;
    let totalBytes = 0;

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const busboy = Busboy({
      headers: { "content-type": contentType },
      limits: { files: 1, fileSize: maxBytes },
    });

    busboy.on("file", (fieldname, fileStream, info) => {
      if (fieldname !== "file" && file) {
        fileStream.resume();
        return;
      }

      const chunks: Buffer[] = [];
      fileStream.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes > maxBytes) {
          fileStream.destroy();
          fail(new TransportError(`Upload exceeds maximum size of ${maxBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });

      fileStream.on("limit", () => {
        fail(new TransportError(`Upload exceeds maximum size of ${maxBytes} bytes`));
      });

      fileStream.on("error", fail);

      fileStream.on("end", () => {
        const buffer = Buffer.concat(chunks);
        file = {
          buffer,
          mimetype: info.mimeType || "application/octet-stream",
          originalName: info.filename || "upload",
          size: buffer.length,
        };
      });
    });

    busboy.on("field", (name, value) => {
      if (name !== "meta") return;
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          meta = parsed as Record<string, unknown>;
        }
      } catch {
        fail(new TransportError("multipart field 'meta' must be valid JSON"));
      }
    });

    busboy.on("error", fail);

    busboy.on("finish", () => {
      if (settled) return;
      if (!file) {
        fail(new TransportError("multipart body must include a file part"));
        return;
      }
      settled = true;
      resolve({ file, meta });
    });

    stream.pipe(busboy);
  });
}

/** SHA-256 content hash in the form `sha256:<hex>`. */
export async function hashFileContent(buffer: Buffer): Promise<string> {
  const { createHash } = await import("node:crypto");
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}
