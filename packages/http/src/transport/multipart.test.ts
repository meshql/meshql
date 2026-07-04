import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { hashFileContent, parseMultipart } from "./multipart.js";

function multipartBody(parts: {
  file?: { name: string; content: string; type?: string };
  meta?: Record<string, unknown>;
}): { body: Buffer; contentType: string } {
  const boundary = "----meshqlboundary";
  const chunks: string[] = [];

  if (parts.file) {
    chunks.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${parts.file.name}"\r\n` +
        `Content-Type: ${parts.file.type ?? "text/plain"}\r\n\r\n` +
        `${parts.file.content}\r\n`,
    );
  }

  if (parts.meta) {
    chunks.push(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="meta"\r\n\r\n` +
        `${JSON.stringify(parts.meta)}\r\n`,
    );
  }

  chunks.push(`--${boundary}--\r\n`);
  const body = Buffer.from(chunks.join(""));
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe("parseMultipart", () => {
  it("parses a single file part", async () => {
    const { body, contentType } = multipartBody({
      file: { name: "a.txt", content: "hello" },
    });

    const parsed = await parseMultipart(Readable.from(body), {
      headers: {
        "content-type": contentType,
        "content-length": String(body.length),
      },
    });

    expect(parsed.file.originalName).toBe("a.txt");
    expect(parsed.file.buffer.toString("utf8")).toBe("hello");
    expect(parsed.file.size).toBe(5);
  });

  it("parses metadata", async () => {
    const { body, contentType } = multipartBody({
      file: { name: "a.txt", content: "x" },
      meta: { note: "hi" },
    });

    const parsed = await parseMultipart(Readable.from(body), {
      headers: { "content-type": contentType },
    });

    expect(parsed.meta).toEqual({ note: "hi" });
  });

  it("rejects oversize Content-Length", async () => {
    const { body, contentType } = multipartBody({
      file: { name: "a.txt", content: "hello" },
    });

    await expect(
      parseMultipart(Readable.from(body), {
        headers: {
          "content-type": contentType,
          "content-length": "1000",
        },
        maxBytes: 10,
      }),
    ).rejects.toThrow("exceeds maximum size");
  });
});

describe("hashFileContent", () => {
  it("returns a sha256 hex digest", async () => {
    const hash = await hashFileContent(Buffer.from("abc"));
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
