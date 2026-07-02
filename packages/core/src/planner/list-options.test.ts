import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIST_LIMIT,
  FILTER_OPS,
  MAX_LIST_LIMIT,
  isFilterOp,
} from "./list-options.js";

describe("list-options constants", () => {
  it("caps at 200 by convention", () => {
    expect(MAX_LIST_LIMIT).toBe(200);
  });

  it("has a sane default", () => {
    expect(DEFAULT_LIST_LIMIT).toBe(50);
    expect(DEFAULT_LIST_LIMIT).toBeLessThan(MAX_LIST_LIMIT);
  });

  it("exposes every filter op", () => {
    expect([...FILTER_OPS].sort()).toEqual(
      [
        "eq",
        "gt",
        "gte",
        "ilike",
        "in",
        "like",
        "lt",
        "lte",
        "ne",
        "nin",
      ].sort(),
    );
  });
});

describe("isFilterOp", () => {
  it("accepts each known operator", () => {
    for (const op of FILTER_OPS) {
      expect(isFilterOp(op)).toBe(true);
    }
  });

  it("rejects unknown operators", () => {
    expect(isFilterOp("regex")).toBe(false);
    expect(isFilterOp("EQ")).toBe(false);
    expect(isFilterOp("")).toBe(false);
    expect(isFilterOp("contains")).toBe(false);
  });
});
