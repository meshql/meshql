import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseJsonQuery, normalizeReadTree } from "./query/index.js";
import { buildJoinPlan } from "./planner/join-plan.js";
import { createQueryContext } from "./resolver/context.js";
import type { MeshSchema } from "./schema/schema.js";
import { shape } from "./shaper/shaper.js";

function astFromQuery(raw: string, schema: MeshSchema) {
  const doc = parseJsonQuery(raw);
  return normalizeReadTree(doc.root, schema).ast;
}

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../../..");

function loadFixture<T>(relativePath: string): T {
  const filePath = path.join(repoRoot, "specs/fixtures", relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

const userTokensSchema: MeshSchema = {
  entities: {
    user: { fields: ["id", "name"], table: "users" },
    token: { fields: ["accessToken"], table: "tokens" },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
    },
  },
};

const postCommentsSchema: MeshSchema = {
  entities: {
    post: { fields: ["id", "title"], table: "posts" },
    comment: { fields: ["id", "body"], table: "comments" },
    user: { fields: ["id", "name"], table: "users" },
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

describe("spec conformance fixtures", () => {
  it("user-with-tokens: parser → planner → shaper", () => {
    const query = loadFixture<Record<string, unknown>>("queries/user-with-tokens.json");
    const fixture = loadFixture<{
      rows: Record<string, unknown>[];
      shaped: Record<string, unknown>;
    }>("responses/user-with-tokens.json");

    const ast = astFromQuery(JSON.stringify(query), userTokensSchema);
    const plan = buildJoinPlan(
      ast,
      userTokensSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(shape(fixture.rows, ast.root, plan.joins)).toEqual(fixture.shaped);
  });

  it("post-comments-author: parser → planner → shaper", () => {
    const query = loadFixture<Record<string, unknown>>(
      "queries/post-comments-author.json",
    );
    const fixture = loadFixture<{
      rows: Record<string, unknown>[];
      shaped: Record<string, unknown>;
    }>("responses/post-comments-author.json");

    const ast = astFromQuery(JSON.stringify(query), postCommentsSchema);
    const plan = buildJoinPlan(
      ast,
      postCommentsSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(shape(fixture.rows, ast.root, plan.joins)).toEqual(fixture.shaped);
  });
});
