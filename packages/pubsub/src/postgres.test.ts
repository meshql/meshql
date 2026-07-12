import { describe, expect, it, vi } from "vitest";
import { PostgresPubSubStore } from "./postgres.js";
import { InMemoryPubSubStore, notifyEntityUpdate } from "./index.js";

describe("notifyEntityUpdate", () => {
  it("publishes on the entity record channel", () => {
    const pubsub = new InMemoryPubSubStore();
    const handler = vi.fn();

    pubsub.subscribe("meshql:post:7", handler);
    notifyEntityUpdate(pubsub, "post", 7, { type: "updated" });

    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("PostgresPubSubStore", () => {
  it("publishes via pg_notify", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as import("pg").Pool;

    const store = new PostgresPubSubStore({ pool });
    await store.publish("meshql:post:1", { type: "updated" });

    expect(query).toHaveBeenCalledWith("SELECT pg_notify($1, $2)", [
      "meshql:post:1",
      expect.stringContaining('"type":"updated"'),
    ]);
  });
});
