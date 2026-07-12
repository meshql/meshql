import { describe, expect, it, vi } from "vitest";
import { createMesh } from "@meshql/core";
import { InMemoryPubSubStore, notifyEntityUpdate } from "@meshql/pubsub";
import { formatSseEvent, handleMeshSse } from "./handler.js";

const schema = {
  entities: {
    post: { type: {}, fields: ["id", "title"], table: "posts" },
  },
  joins: {},
};

describe("formatSseEvent", () => {
  it("formats SSE frames", () => {
    expect(formatSseEvent({ data: { id: 1 } })).toBe(
      'data: {"id":1}\n\n',
    );
    expect(formatSseEvent({ event: "update", data: { id: 1 } })).toBe(
      'event: update\ndata: {"id":1}\n\n',
    );
  });
});

describe("handleMeshSse", () => {
  it("pushes an initial snapshot and updates on pub/sub notify", async () => {
    const mesh = createMesh(schema);
    let title = "Hello";
    mesh.resolve("post", async () => [{ post_id: 1, post_title: title }]);

    const pubsub = new InMemoryPubSubStore();
    const chunks: string[] = [];

    const req = {
      method: "GET",
      params: { entity: "post", id: "1" },
      headers: {
        "x-mesh-query": Buffer.from(
          JSON.stringify({ post: { id: true, title: true } }),
        ).toString("base64"),
        "x-mesh-format": "json",
      },
    };

    let closeCallback: (() => void) | undefined;
    const ssePromise = handleMeshSse(
      mesh,
      req,
      {
        write: (chunk) => chunks.push(chunk),
        end: vi.fn(),
        onClose: (callback) => {
          closeCallback = callback;
        },
      },
      { pubsub, heartbeatMs: 60_000 },
    );

    await ssePromise;

    expect(chunks.some((chunk) => chunk.includes('"title":"Hello"'))).toBe(true);

    title = "Updated";
    notifyEntityUpdate(pubsub, "post", 1);

    await vi.waitFor(() => {
      expect(chunks.some((chunk) => chunk.includes('"title":"Updated"'))).toBe(
        true,
      );
    });

    closeCallback?.();
  });
});
