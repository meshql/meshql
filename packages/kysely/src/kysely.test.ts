import { describe, expect, it, vi } from "vitest";
import {
  buildJoinPlan,
  createMesh,
  createQueryContext,
  parseQl,
  type MeshSchema,
} from "@meshql/core";
import { kyselyResolver } from "./index.js";

const schema: MeshSchema = {
  entities: {
    user: { type: {}, fields: ["id", "name"], table: "users" },
    token: {
      type: {},
      fields: ["accessToken"],
      table: "tokens",
      columns: { accessToken: "access_token" },
    },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
    },
  },
};

describe("kyselyResolver", () => {
  it("executes sqlite SQL and returns flat rows for the shaper", async () => {
    const executeQuery = vi.fn().mockResolvedValue({
      rows: [
        {
          user_id: 1,
          user_name: "Ada",
          tokens_accessToken: "abc",
          tokens_id: 10,
        },
      ],
    });

    const mesh = createMesh(schema);
    mesh.resolve("*", kyselyResolver({ executeQuery }, { schema, dialect: "sqlite" }));

    const result = await mesh.execute("{ user { id name tokens { accessToken } } }", {
      context: { requestId: "1", method: "GET", entityId: "1" },
    });

    expect(executeQuery).toHaveBeenCalledOnce();
    expect(executeQuery.mock.calls[0]![0].sql).toContain("FROM users");
    expect(result).toEqual({
      id: 1,
      name: "Ada",
      tokens: [{ accessToken: "abc" }],
    });
  });
});
