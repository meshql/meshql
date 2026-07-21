import { describe, expect, it } from "vitest";
import { queryToJson } from "./read-query.js";

describe("queryToJson", () => {
  it("serializes a canonical query without rewriting it", () => {
    expect(
      queryToJson({
        user: {
          $select: {
            id: true,
            tokens: { $select: { accessToken: true } },
          },
          $page: { first: 20 },
        },
      }),
    ).toBe(
      '{"user":{"$select":{"id":true,"tokens":{"$select":{"accessToken":true}}},"$page":{"first":20}}}',
    );
  });

  it("requires exactly one root entity", () => {
    expect(() => queryToJson({})).toThrow(
      "MeshQL query must have exactly one root entity",
    );
  });
});
