import { describe, expect, it } from "vitest";
import { normalizeFieldPath, stripFieldsFromPlan } from "./strip-fields.js";
import type { MeshSchema } from "../schema/schema.js";
import { createQueryContext } from "../resolver/context.js";

const schema: MeshSchema = {
  entities: {
    user: { type: {}, fields: ["id", "email"], table: "users" },
    token: { type: {}, fields: ["accessToken"], table: "tokens" },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
    },
  },
};

describe("stripFieldsFromPlan", () => {
  it("normalizes root entity field paths", () => {
    expect(normalizeFieldPath("user.email", schema)).toBe("users.email");
  });

  it("normalizes nested join field paths", () => {
    expect(normalizeFieldPath("user.tokens.accessToken", schema)).toBe(
      "tokens.accessToken",
    );
  });

  it("strips denied fields from plan", () => {
    const plan = stripFieldsFromPlan(
      {
        rootEntity: "user",
        idField: "id",
        fields: ["users.id", "users.email", "tokens.accessToken"],
        joins: [
          {
            entity: "token",
            on: "on",
            fields: ["tokens.accessToken"],
            type: "many",
            refName: "tokens",
            idField: "id",
          },
        ],
        context: createQueryContext({ requestId: "1", method: "GET" }),
      },
      ["user.email", "user.tokens.accessToken"],
      schema,
    );

    expect(plan.fields).toEqual(["users.id"]);
    expect(plan.joins[0]?.fields).toEqual([]);
  });
});
