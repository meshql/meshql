import { describe, expect, it } from "vitest";
import { createQueryContext } from "../resolver/context.js";
import type { MeshSchema } from "../schema/schema.js";
import { buildJoinPlan } from "./join-plan.js";
import { parseQl } from "../parser/index.js";
import {
  buildPathToSqlAlias,
  joinsInDependencyOrder,
  resolvePlanField,
  rewriteJoinOn,
  rowAliasForPlanField,
} from "./sql-from-plan.js";

const blogSchema: MeshSchema = {
  entities: {
    post: { type: {}, fields: ["id", "title"], table: "posts" },
    comment: { type: {}, fields: ["id", "body"], table: "comments" },
    user: {
      type: {},
      fields: ["id", "name"],
      table: "users",
      columns: { name: "display_name" },
    },
  },
  joins: {
    "post.comments": {
      entity: "comment",
      on: "comments.post_id = posts.id",
      type: "many",
    },
    "comments.author": {
      entity: "user",
      on: "users.id = comments.author_id",
      type: "one",
    },
  },
};

function blogPlan() {
  const ast = parseQl(
    "{ post { id comments { body author { name } } } }",
  );
  return buildJoinPlan(
    ast,
    blogSchema,
    createQueryContext({ requestId: "1", method: "GET" }),
  );
}

describe("rowAliasForPlanField", () => {
  it("uses join path alias for nested fields", () => {
    const plan = blogPlan();
    expect(rowAliasForPlanField("comments.body", plan)).toBe("comments_body");
    expect(rowAliasForPlanField("comments.author.name", plan)).toBe(
      "comments_author_name",
    );
  });
});

describe("joinsInDependencyOrder", () => {
  it("orders shallow joins before deeper ones", () => {
    const plan = blogPlan();
    const ordered = joinsInDependencyOrder(plan.joins);
    expect(ordered.map((join) => join.path)).toEqual([
      "comments",
      "comments.author",
    ]);
  });
});

describe("rewriteJoinOn", () => {
  it("substitutes parent and self table names with SQL aliases", () => {
    const plan = blogPlan();
    const pathToAlias = buildPathToSqlAlias(plan);
    const authorJoin = plan.joins.find((join) => join.path === "comments.author")!;

    const rewritten = rewriteJoinOn(
      authorJoin.on,
      authorJoin,
      plan.joins,
      pathToAlias,
      blogSchema,
    );

    expect(rewritten).toBe("comments_author.id = comments.author_id");
  });
});

describe("resolvePlanField", () => {
  it("honors entity column remapping", () => {
    const plan = blogPlan();
    const resolved = resolvePlanField(
      "comments.author.name",
      plan,
      blogSchema,
      "posts",
    );

    expect(resolved).toEqual({
      sqlTableRef: "comments_author",
      sqlColumn: "display_name",
      entityKey: "user",
    });
  });

  it("resolves root fields against the root table ref", () => {
    const plan = blogPlan();
    const resolved = resolvePlanField("posts.title", plan, blogSchema, "posts");

    expect(resolved).toEqual({
      sqlTableRef: "posts",
      sqlColumn: "title",
      entityKey: "post",
    });
  });
});
