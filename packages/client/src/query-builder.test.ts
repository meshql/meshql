import { describe, expect, it } from "vitest";
import { queryToQl } from "./query-builder.js";

describe("queryToQl", () => {
  it("serializes a canonical nested query into brace syntax", () => {
    expect(
      queryToQl({
        user: {
          $select: {
            id: true,
            name: true,
            tokens: { $select: { accessToken: true } },
          },
        },
      }),
    ).toBe("{ user { id name tokens { accessToken } } }");
  });

  it("requires exactly one root entity", () => {
    expect(() =>
      queryToQl({
        user: { $select: { id: true } },
        post: { $select: { id: true } },
      }),
    ).toThrow("MeshQL query must have exactly one root entity");
  });

  it("rejects controls because QL is selection-only", () => {
    expect(() =>
      queryToQl({
        user: {
          $select: { id: true },
          $page: { first: 10 },
        },
      }),
    ).toThrow("QL format is selection-only");
  });
});
