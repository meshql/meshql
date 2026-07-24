import { describe, expect, it } from "vitest";
import { createMesh, type MeshSchema } from "../index.js";
import { buildJoinPlan } from "../planner/join-plan.js";
import {
  emitJoinSql,
  polymorphicEntitySelectExpr,
  polymorphicSelectExpr,
  buildPathToSqlAlias,
} from "../planner/sql-from-plan.js";
import { parseQl } from "../parser/index.js";
import { createQueryContext } from "../resolver/context.js";
import { shape } from "../shaper/shaper.js";
import { validateJoins } from "../schema/validate-joins.js";
import { ValidationError } from "../errors/index.js";

const polySchema: MeshSchema = {
  entities: {
    comment: { fields: ["id", "body"], table: "comments" },
    post: { fields: ["id", "title"], table: "posts" },
    image: { fields: ["id", "url"], table: "images" },
  },
  joins: {
    "comment.commentable": {
      type: "one",
      entities: ["post", "image"],
      on: "/* polymorphic */",
      polymorphic: {
        typeColumn: "commentable_type",
        idColumn: "commentable_id",
        map: { Post: "post", Image: "image" },
      },
    },
  },
};

describe("validateJoins — polymorphic", () => {
  it("accepts a valid polymorphic join", () => {
    expect(() => validateJoins(polySchema)).not.toThrow();
  });

  it("rejects polymorphic + entity together", () => {
    expect(() =>
      validateJoins({
        ...polySchema,
        joins: {
          "comment.commentable": {
            ...polySchema.joins["comment.commentable"]!,
            entity: "post",
          },
        },
      }),
    ).toThrow(/cannot set both 'entity' and 'polymorphic'/);
  });

  it("rejects polymorphic many", () => {
    expect(() =>
      validateJoins({
        ...polySchema,
        joins: {
          "comment.commentable": {
            ...polySchema.joins["comment.commentable"]!,
            type: "many",
          },
        },
      }),
    ).toThrow(/only supports type 'one'/);
  });

  it("createMesh validates joins", () => {
    expect(() =>
      createMesh({
        ...polySchema,
        joins: {
          "comment.broken": {
            type: "one",
            on: "x",
            polymorphic: {
              typeColumn: "t",
              idColumn: "i",
              map: { Post: "post" },
            },
          },
        },
      }),
    ).toThrow(ValidationError);
  });
});

describe("polymorphic joins — plan / sql / shape", () => {
  it("plans commentable fields across the union", () => {
    const ast = parseQl("{ comment { id commentable { id title url } } }");
    const plan = buildJoinPlan(
      ast,
      polySchema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "1" }),
    );

    expect(plan.joins[0]).toMatchObject({
      path: "commentable",
      joinKey: "comment.commentable",
      polymorphic: expect.objectContaining({
        typeColumn: "commentable_type",
        entities: ["post", "image"],
      }),
    });
    expect(plan.fields).toEqual(
      expect.arrayContaining([
        "comments.id",
        "commentable.id",
        "commentable.title",
        "commentable.url",
      ]),
    );
  });

  it("emits one LEFT JOIN per polymorphic target", () => {
    const ast = parseQl("{ comment { id commentable { id title } } }");
    const plan = buildJoinPlan(
      ast,
      polySchema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "1" }),
    );
    const join = plan.joins[0]!;
    const sql = emitJoinSql(
      join,
      plan,
      polySchema,
      buildPathToSqlAlias(plan),
      "comments",
    );

    expect(sql).toContain(
      'LEFT JOIN posts AS commentable__post ON comments."commentable_type" = \'Post\' AND comments."commentable_id" = commentable__post.id',
    );
    expect(sql).toContain(
      'LEFT JOIN images AS commentable__image ON comments."commentable_type" = \'Image\' AND comments."commentable_id" = commentable__image.id',
    );
  });

  it("builds CASE expressions for poly fields and $entity", () => {
    const ast = parseQl("{ comment { commentable { title } } }");
    const plan = buildJoinPlan(
      ast,
      polySchema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "1" }),
    );
    const join = plan.joins[0]!;

    expect(polymorphicSelectExpr("commentable.title", plan, polySchema, "comments")).toBe(
      'CASE WHEN comments."commentable_type" = \'Post\' THEN commentable__post.title END',
    );
    expect(polymorphicEntitySelectExpr(join, plan, "comments")).toContain(
      "THEN 'post'",
    );
    expect(polymorphicEntitySelectExpr(join, plan, "comments")).toContain(
      "THEN 'image'",
    );
  });

  it("shapes polymorphic rows with $entity", () => {
    const ast = parseQl("{ comment { id commentable { id title url } } }");
    const plan = buildJoinPlan(
      ast,
      polySchema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "1" }),
    );

    const shaped = shape(
      [
        {
          comment_id: 1,
          commentable_id: 10,
          commentable_title: "Hello",
          commentable_url: null,
          "commentable_$entity": "post",
        },
      ],
      ast.root,
      plan.joins,
    );

    expect(shaped).toEqual({
      id: 1,
      commentable: { $entity: "post", id: 10, title: "Hello" },
    });
  });

  it("shapes image polymorphic rows", () => {
    const ast = parseQl("{ comment { commentable { id url } } }");
    const plan = buildJoinPlan(
      ast,
      polySchema,
      createQueryContext({ requestId: "1", method: "GET", entityId: "1" }),
    );

    const shaped = shape(
      [
        {
          comment_id: 1,
          commentable_id: 5,
          commentable_url: "https://x/y.png",
          "commentable_$entity": "image",
        },
      ],
      ast.root,
      plan.joins,
    );

    expect(shaped).toEqual({
      commentable: { $entity: "image", id: 5, url: "https://x/y.png" },
    });
  });
});
