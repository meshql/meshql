import { describe, expect, it } from "vitest";
import { buildJoinPlan } from "./join-plan.js";
import { parseQl } from "../parser/index.js";
import { createQueryContext } from "../resolver/context.js";
import type { MeshSchema } from "../schema/schema.js";

const schema: MeshSchema = {
  entities: {
    user: { type: {}, fields: ["id", "name"] },
    token: { type: {}, fields: ["accessToken"] },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
    },
  },
};

describe("buildJoinPlan", () => {
  it("includes only requested joins", () => {
    const ast = parseQl("{ user { id tokens { accessToken } } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.rootEntity).toBe("user");
    expect(plan.idField).toBe("id");
    // Root id was requested; tokens.id is auto-added so the shaper can dedupe.
    expect(plan.fields).toEqual(["users.id", "tokens.accessToken", "tokens.id"]);
    expect(plan.joins).toHaveLength(1);
    expect(plan.joins[0]?.path).toBe("tokens");
    expect(plan.joins[0]?.joinKey).toBe("user.tokens");
    expect(plan.joins[0]?.on).toBe("tokens.user_id = users.id");
    expect(plan.joins[0]?.idField).toBe("id");
    expect(plan.joins[0]?.fields).toEqual(["tokens.accessToken", "tokens.id"]);
  });

  it("does not duplicate the id when already requested", () => {
    const ast = parseQl("{ user { id tokens { id accessToken } } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.fields).toEqual(["users.id", "tokens.id", "tokens.accessToken"]);
  });

  it("auto-adds the root id when missing from the selection", () => {
    const ast = parseQl("{ user { name } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.fields).toEqual(["users.name", "users.id"]);
  });

  it("respects a custom idField on entities", () => {
    const customSchema: MeshSchema = {
      entities: {
        user: { type: {}, fields: ["uuid", "name"], idField: "uuid" },
        token: {
          type: {},
          fields: ["sid", "accessToken"],
          idField: "sid",
        },
      },
      joins: {
        "user.tokens": {
          entity: "token",
          on: "tokens.user_uuid = users.uuid",
          type: "many",
        },
      },
    };

    const ast = parseQl("{ user { name tokens { accessToken } } }");
    const plan = buildJoinPlan(
      ast,
      customSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.idField).toBe("uuid");
    expect(plan.joins[0]?.idField).toBe("sid");
    expect(plan.fields).toEqual([
      "users.name",
      "users.uuid",
      "tokens.accessToken",
      "tokens.sid",
    ]);
  });

  it("uses the entity's declared table for the SELECT prefix (irregular plural)", () => {
    const irregularSchema: MeshSchema = {
      entities: {
        address: {
          type: {},
          fields: ["id", "street"],
          table: "addresses",
        },
      },
      joins: {},
    };

    const ast = parseQl("{ address { street } }");
    const plan = buildJoinPlan(
      ast,
      irregularSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.rootEntity).toBe("address");
    expect(plan.fields).toEqual(["addresses.street", "addresses.id"]);
  });

  it("resolves a plural root name back to the declared entity key", () => {
    const ast = parseQl("{ users { id name } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.rootEntity).toBe("user");
    expect(plan.fields).toEqual(["users.id", "users.name"]);
  });

  it("attaches list options to the plan when provided", () => {
    const ast = parseQl("{ user { id name } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
      {
        list: {
          limit: 20,
          orderBy: [{ field: "name", dir: "asc" }],
          filter: [{ field: "id", op: "gt", value: 100 }],
        },
      },
    );

    expect(plan.list).toEqual({
      limit: 20,
      orderBy: [{ field: "name", dir: "asc" }],
      filter: [{ field: "id", op: "gt", value: 100 }],
    });
  });

  it("leaves plan.list undefined for point reads", () => {
    const ast = parseQl("{ user { id name } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.list).toBeUndefined();
  });

  it("plans nested joins (post → comments → author)", () => {
    const blogSchema: MeshSchema = {
      entities: {
        post: { type: {}, fields: ["id", "title"], table: "posts" },
        comment: { type: {}, fields: ["id", "body"], table: "comments" },
        user: { type: {}, fields: ["id", "name"], table: "users" },
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

    const ast = parseQl(
      "{ post { id comments { body author { name } } } }",
    );
    const plan = buildJoinPlan(
      ast,
      blogSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.joins).toHaveLength(2);
    expect(plan.joins[0]).toMatchObject({
      path: "comments",
      joinKey: "post.comments",
      refName: "comments",
    });
    expect(plan.joins[1]).toMatchObject({
      path: "comments.author",
      joinKey: "comments.author",
      refName: "author",
    });
    expect(plan.fields).toEqual([
      "posts.id",
      "comments.body",
      "comments.id",
      "comments.author.name",
      "comments.author.id",
    ]);
  });

  it("rejects a missing join definition", () => {
    const ast = parseQl("{ user { id tokens { accessToken } } }");
    const schemaWithoutJoin: MeshSchema = {
      entities: {
        user: { type: {}, fields: ["id", "name"] },
        token: { type: {}, fields: ["accessToken"] },
      },
      joins: {},
    };

    expect(() =>
      buildJoinPlan(
        ast,
        schemaWithoutJoin,
        createQueryContext({ requestId: "1", method: "GET" }),
      ),
    ).toThrow("No join defined for 'user.tokens'");
  });

  it("rejects an unknown root entity", () => {
    const ast = parseQl("{ ghost { id } }");
    expect(() =>
      buildJoinPlan(
        ast,
        schema,
        createQueryContext({ requestId: "1", method: "GET" }),
      ),
    ).toThrow("Unknown entity 'ghost'");
  });
});
