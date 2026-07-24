import { describe, expect, it } from "vitest";
import { createQueryContext } from "../resolver/context.js";
import type { MeshSchema } from "../schema/schema.js";
import { buildJoinPlan } from "./join-plan.js";
import { parseQl } from "../parser/index.js";
import {
  buildPathToSqlAlias,
  emitJoinSql,
  joinsInDependencyOrder,
  junctionAliasForJoinPath,
  resolvePlanField,
  rewriteJoinOn,
  rowAliasForPlanField,
} from "./sql-from-plan.js";

const blogSchema: MeshSchema = {
  entities: {
    post: { fields: ["id", "title"], table: "posts" },
    comment: { fields: ["id", "body"], table: "comments" },
    user: {
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

const m2mSchema: MeshSchema = {
  entities: {
    post: { fields: ["id", "title"], table: "posts" },
    tag: { fields: ["id", "name"], table: "tags" },
  },
  joins: {
    "post.tags": {
      entity: "tag",
      on: "_PostToTag.A = posts.id",
      type: "many",
      table: "tags",
      through: { table: "_PostToTag", from: "A", to: "B" },
    },
  },
};

describe("emitJoinSql — through (M2M)", () => {
  it("emits a two-hop join with a collision-safe junction alias", () => {
    const ast = parseQl("{ post { id tags { name } } }");
    const plan = buildJoinPlan(
      ast,
      m2mSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );
    const pathToAlias = buildPathToSqlAlias(plan);
    const tagsJoin = plan.joins.find((join) => join.path === "tags")!;

    expect(junctionAliasForJoinPath("tags")).toBe("tags__junc");
    expect(
      emitJoinSql(tagsJoin, plan, m2mSchema, pathToAlias, "posts"),
    ).toBe(
      ' LEFT JOIN _PostToTag AS tags__junc ON tags__junc."A" = posts.id' +
        ' LEFT JOIN tags AS tags ON tags.id = tags__junc."B"',
    );
  });

  it("uses entityPhysicalIdColumn for non-id primary keys", () => {
    const schema: MeshSchema = {
      entities: {
        post: {
          fields: ["uuid", "title"],
          idField: "uuid",
          table: "posts",
          columns: { uuid: "post_uuid" },
        },
        tag: {
          fields: ["uuid", "name"],
          idField: "uuid",
          table: "tags",
          columns: { uuid: "tag_uuid" },
        },
      },
      joins: {
        "post.tags": {
          entity: "tag",
          on: "post_tags.post_id = posts.post_uuid",
          type: "many",
          table: "tags",
          through: { table: "post_tags", from: "post_id", to: "tag_id" },
        },
      },
    };

    const ast = parseQl("{ post { uuid tags { name } } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );
    const pathToAlias = buildPathToSqlAlias(plan);
    const tagsJoin = plan.joins.find((join) => join.path === "tags")!;

    expect(emitJoinSql(tagsJoin, plan, schema, pathToAlias, "posts")).toBe(
      ' LEFT JOIN post_tags AS tags__junc ON tags__junc."post_id" = posts.post_uuid' +
        ' LEFT JOIN tags AS tags ON tags.tag_uuid = tags__junc."tag_id"',
    );
  });
});
