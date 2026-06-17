import { describe, expect, it } from "vitest";
import { parseQl } from "../parser/index.js";
import { shape } from "./shaper.js";

describe("shape", () => {
  it("nests flat rows", () => {
    const ast = parseQl("{ user { id name tokens { accessToken } } }");
    const result = shape(
      [
        {
          user_id: 1,
          user_name: "Ada",
          tokens_accessToken: "abc",
        },
      ],
      ast.root,
      [
        {
          entity: "token",
          on: "tokens.user_id = users.id",
          fields: ["tokens.accessToken"],
          type: "many",
          refName: "tokens",
        },
      ],
    );

    expect(result).toEqual({
      id: 1,
      name: "Ada",
      tokens: [{ accessToken: "abc" }],
    });
  });
});
