import { describe, expect, it } from "vitest";
import { buildJoinPlan } from "../planner/join-plan.js";
import { buildPlanRelationTree } from "./plan-relations.js";
import { createQueryContext } from "../resolver/context.js";
import { parseQl } from "../parser/index.js";
import type { MeshSchema } from "../schema/schema.js";

const schema: MeshSchema = {
  entities: {
    post: {
      type: {},
      fields: ["id", "title"],
      table: "posts",
    },
    comment: {
      type: {},
      fields: ["id", "body"],
      table: "comments",
    },
    user: {
      type: {},
      fields: ["id", "name"],
      table: "users",
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

describe("buildPlanRelationTree", () => {
  it("builds nested relation nodes from a deep join plan", () => {
    const ast = parseQl("{ post { title comments { body author { name } } } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    const tree = buildPlanRelationTree(plan, schema);
    expect(tree.scalars.sort()).toEqual(["id", "title"]);
    expect(tree.relations).toHaveLength(1);
    expect(tree.relations[0]).toMatchObject({
      path: "comments",
      refName: "comments",
      entity: "comment",
      scalars: ["body", "id"],
    });
    expect(tree.relations[0]?.children[0]).toMatchObject({
      path: "comments.author",
      refName: "author",
      entity: "user",
      scalars: ["name", "id"],
      children: [],
    });
  });
});
