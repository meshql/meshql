import { describe, expect, it, vi } from "vitest";
import {
  entityChannel,
  entityRecordChannel,
  InMemoryPubSubStore,
  parseMeshChannel,
} from "./index.js";

describe("channel helpers", () => {
  it("builds entity and record channels", () => {
    expect(entityChannel("post")).toBe("meshql:post");
    expect(entityRecordChannel("post", 42)).toBe("meshql:post:42");
  });

  it("parses channels back", () => {
    expect(parseMeshChannel("meshql:post")).toEqual({ entity: "post" });
    expect(parseMeshChannel("meshql:post:42")).toEqual({
      entity: "post",
      id: "42",
    });
    expect(parseMeshChannel("other:post")).toBeNull();
  });
});

describe("InMemoryPubSubStore", () => {
  it("delivers published messages to subscribers", async () => {
    const store = new InMemoryPubSubStore();
    const handler = vi.fn();

    store.subscribe("meshql:post:1", handler);
    store.publish("meshql:post:1", { title: "Updated" });

    await Promise.resolve();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      channel: "meshql:post:1",
      payload: { title: "Updated" },
    });
    expect(handler.mock.calls[0]?.[0].publishedAt).toBeTypeOf("number");
  });

  it("does not cross-deliver between channels", () => {
    const store = new InMemoryPubSubStore();
    const handler = vi.fn();

    store.subscribe("meshql:post:1", handler);
    store.publish("meshql:post:2", { title: "Other" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribe stops delivery", () => {
    const store = new InMemoryPubSubStore();
    const handler = vi.fn();

    const sub = store.subscribe("meshql:post:1", handler);
    sub.unsubscribe();
    store.publish("meshql:post:1", { title: "Late" });

    expect(handler).not.toHaveBeenCalled();
    expect(store.subscriberCount("meshql:post:1")).toBe(0);
  });

  it("supports multiple subscribers on one channel", () => {
    const store = new InMemoryPubSubStore();
    const a = vi.fn();
    const b = vi.fn();

    store.subscribe("meshql:user", a);
    store.subscribe("meshql:user", b);
    store.publish("meshql:user", { count: 2 });

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});
