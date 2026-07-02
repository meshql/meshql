import { describe, expect, it } from "vitest";
import { selectionToJson, selectionToQl } from "./query-builder.js";

describe("selectionToJson", () => {
  it("serializes a bare selection unchanged", () => {
    expect(selectionToJson({ user: { id: true, name: true } })).toBe(
      '{"user":{"id":true,"name":true}}',
    );
  });

  it("appends $list metadata when provided", () => {
    const raw = selectionToJson(
      { user: { id: true } },
      {
        limit: 20,
        filter: [{ field: "role", op: "eq", value: "admin" }],
      },
    );
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({
      user: { id: true },
      $list: {
        limit: 20,
        filter: [{ field: "role", op: "eq", value: "admin" }],
      },
    });
  });

  it("omits $list when the argument is undefined", () => {
    const raw = selectionToJson({ user: { id: true } });
    expect(raw).not.toContain("$list");
  });
});

describe("selectionToQl", () => {
  it("serializes a nested selection into brace syntax", () => {
    expect(
      selectionToQl({
        user: { id: true, name: true, tokens: { accessToken: true } },
      }),
    ).toBe("{ user { id name tokens { accessToken } } }");
  });

  it("requires exactly one root entity", () => {
    expect(() =>
      selectionToQl({ user: { id: true }, post: { id: true } }),
    ).toThrow("Query selection must have exactly one root entity");
  });
});
