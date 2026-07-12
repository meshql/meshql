import { describe, expect, it } from "vitest";
import { parseQl } from "../parser/index.js";
import {
  collectAstNodes,
  joinPathAlias,
  parseQualifiedPlanField,
  qualifiedJoinField,
} from "./join-plan.js";

describe("join-plan helpers", () => {
  it("collectAstNodes returns root and nested refs in DFS order", () => {
    const ast = parseQl("{ post { id comments { body author { name } } } }");
    const nodes = collectAstNodes(ast.root);

    expect(nodes.map((node) => node.name)).toEqual([
      "post",
      "comments",
      "author",
    ]);
  });

  it("parseQualifiedPlanField prefers the longest matching join path", () => {
    const joinPaths = ["comments", "comments.author"];
    expect(parseQualifiedPlanField("comments.author.name", "post", joinPaths)).toEqual({
      joinPath: "comments.author",
      column: "name",
    });
    expect(parseQualifiedPlanField("comments.body", "post", joinPaths)).toEqual({
      joinPath: "comments",
      column: "body",
    });
  });

  it("qualifiedJoinField and joinPathAlias follow the dot/underscore contract", () => {
    expect(qualifiedJoinField("comments.author", "name")).toBe("comments.author.name");
    expect(joinPathAlias("comments.author")).toBe("comments_author");
  });
});
