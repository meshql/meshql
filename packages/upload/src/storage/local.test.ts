import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLocalStorage } from "./local.js";

describe("createLocalStorage", () => {
  let directory: string;

  afterEach(async () => {
    if (directory) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("round-trips a file", async () => {
    directory = await mkdtemp(path.join(tmpdir(), "meshql-upload-"));
    const storage = createLocalStorage({ directory });
    const file = {
      buffer: Buffer.from("hello avatar"),
      mimetype: "text/plain",
      originalName: "avatar.txt",
      size: 12,
    };

    const key = await storage.put(file, "user/1/avatar.txt");
    expect(key).toBe("user/1/avatar.txt");

    const read = await storage.get(key);
    expect(read.toString("utf8")).toBe("hello avatar");

    await storage.delete(key);
    await expect(storage.get(key)).rejects.toThrow();
  });

  it("rejects path traversal keys", async () => {
    directory = await mkdtemp(path.join(tmpdir(), "meshql-upload-"));
    const storage = createLocalStorage({ directory });
    await expect(
      storage.put(
        {
          buffer: Buffer.from("x"),
          mimetype: "text/plain",
          originalName: "x",
          size: 1,
        },
        "../escape.txt",
      ),
    ).rejects.toThrow("Invalid storage key");
  });
});
