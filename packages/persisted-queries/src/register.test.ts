import { describe, expect, it } from "vitest";
import { createQueryId, registerQuery } from "./register.js";
import { InMemoryQueryStore } from "./store.js";

describe("registerQuery", () => {
  it("returns a stable content-addressed ID", () => {
    const store = new InMemoryQueryStore();
    const raw = '{"user":{"id":true}}';

    const first = registerQuery(store, raw, "json");
    const second = registerQuery(store, raw, "json");

    expect(first).toBe(second);
    expect(first.startsWith("q_")).toBe(true);
    expect(createQueryId(raw, "json")).toBe(first);
  });

  it("extends the ID when a hash collision occurs", () => {
    const store = new InMemoryQueryStore();
    const raw = '{"user":{"id":true}}';
    const collidingId = createQueryId(raw, "json");

    store.save(collidingId, {
      raw: '{"other":true}',
      format: "json",
      createdAt: 1,
    });

    const id = registerQuery(store, raw, "json");
    expect(id.startsWith(collidingId)).toBe(true);
    expect(id.length).toBeGreaterThan(collidingId.length);
  });
});
