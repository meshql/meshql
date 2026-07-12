import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor.js";

describe("cursor helpers", () => {
  it("encodes and decodes round-trip", () => {
    const encoded = encodeCursor({ id: 42 });
    expect(decodeCursor(encoded)).toEqual({ id: 42 });
  });

  it("supports string ids", () => {
    const encoded = encodeCursor({ id: "01HZ7XYZ" });
    expect(decodeCursor(encoded)).toEqual({ id: "01HZ7XYZ" });
  });

  it("produces URL-safe output", () => {
    const encoded = encodeCursor({ id: "abc?def=ghi&jkl" });
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeCursor(encoded)).toEqual({ id: "abc?def=ghi&jkl" });
  });

  it("throws on non-JSON payloads", () => {
    const bogus = Buffer.from("not json", "utf8").toString("base64url");
    expect(() => decodeCursor(bogus)).toThrow("Invalid cursor: not valid JSON");
  });

  it("throws on payloads missing 'id'", () => {
    const bogus = Buffer.from(JSON.stringify({ x: 1 }), "utf8").toString(
      "base64url",
    );
    expect(() => decodeCursor(bogus)).toThrow("Invalid cursor: missing 'id' field");
  });
});
