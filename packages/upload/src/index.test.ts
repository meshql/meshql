import { describe, expect, it } from "vitest";
import { parseSize } from "./index.js";

describe("parseSize", () => {
  it("parses common units", () => {
    expect(parseSize("25mb")).toBe(25 * 1024 * 1024);
    expect(parseSize("1kb")).toBe(1024);
    expect(parseSize("100")).toBe(100);
  });

  it("rejects invalid values", () => {
    expect(() => parseSize("big")).toThrow("Invalid size");
  });
});
