import { describe, expect, it } from "vitest";
import { parseQl, tokenize } from "./index.js";

describe("tokenizer", () => {
  it("tokenizes ql syntax", () => {
    expect(tokenize("{ user { id name } }")).toEqual([
      { type: "LBRACE", value: "{" },
      { type: "IDENT", value: "user" },
      { type: "LBRACE", value: "{" },
      { type: "IDENT", value: "id" },
      { type: "IDENT", value: "name" },
      { type: "RBRACE", value: "}" },
      { type: "RBRACE", value: "}" },
      { type: "EOF", value: "" },
    ]);
  });
});

describe("parseQl", () => {
  it("builds nested AST", () => {
    const ast = parseQl("{ user { id name tokens { accessToken } } }");
    expect(ast.root).toEqual({
      name: "user",
      fields: ["id", "name"],
      refs: [
        {
          name: "tokens",
          fields: ["accessToken"],
          refs: [],
        },
      ],
    });
  });
});
