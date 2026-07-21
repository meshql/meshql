import { describe, expect, it } from "vitest";
import { selectionToJson, selectionToQl } from "./query-builder.js";

describe("selectionToJson", () => {
  it("serializes a bare selection unchanged", () => {
    expect(selectionToJson({ user: { id: true, name: true } })).toBe(
      '{"user":{"id":true,"name":true}}',
    );
  });

  it("serializes a nested selection", () => {
    expect(
      selectionToJson({ user: { id: true, tokens: { accessToken: true } } }),
    ).toBe('{"user":{"id":true,"tokens":{"accessToken":true}}}');
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
