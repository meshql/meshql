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
});
