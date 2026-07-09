import { describe, expect, it } from "vitest";
import { InMemoryQueryStore } from "./store.js";

describe("InMemoryQueryStore", () => {
  it("saves and retrieves persisted queries", () => {
    const store = new InMemoryQueryStore();
    store.save("q_abcd1234", {
      raw: '{"user":{"id":true}}',
      format: "json",
      createdAt: 1,
    });

    expect(store.get("q_abcd1234")?.raw).toBe('{"user":{"id":true}}');
    expect(store.findByContent('{"user":{"id":true}}', "json")).toBe("q_abcd1234");
  });
});
