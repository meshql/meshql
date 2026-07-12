import { describe, expect, it } from "vitest";
import { decodePubSubWire, encodePubSubWire } from "./serialize.js";

describe("pub/sub wire codec", () => {
  it("round-trips channel and payload", () => {
    const raw = encodePubSubWire("meshql:post:1", { type: "updated" });
    const message = decodePubSubWire("meshql:post:1", raw);

    expect(message.channel).toBe("meshql:post:1");
    expect(message.payload).toEqual({ type: "updated" });
    expect(message.publishedAt).toBeTypeOf("number");
  });

  it("falls back to raw string on invalid JSON", () => {
    const message = decodePubSubWire("meshql:post:1", "plain-text");
    expect(message.payload).toBe("plain-text");
  });
});
