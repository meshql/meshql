import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseJsonQuery, normalizeReadTree, astNodeToWire } from "./query/index.js";
import { parseQl } from "./parser/index.js";
import { buildJoinPlan } from "./planner/join-plan.js";
import { createQueryContext } from "./resolver/context.js";
import type { MeshSchema } from "./schema/schema.js";
import { shape } from "./shaper/shaper.js";
import { shapeNested } from "./shaper/nested.js";

function astFromJsonQuery(raw: string, schema: MeshSchema) {
  const doc = parseJsonQuery(raw);
  return normalizeReadTree(doc.root, schema).ast;
}

function astFromQlQuery(raw: string, schema: MeshSchema) {
  return normalizeReadTree(astNodeToWire(parseQl(raw).root), schema).ast;
}

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../../..");

function loadFixture<T>(relativePath: string): T {
  const filePath = path.join(repoRoot, "specs/fixtures", relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function loadTextFixture(relativePath: string): string {
  const filePath = path.join(repoRoot, "specs/fixtures", relativePath);
  return fs.readFileSync(filePath, "utf8").trim();
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
    "comment.author": {
      entity: "user",
      on: "users.id = comments.author_id",
      type: "one",
    },
  },
};

const userPostsSchema: MeshSchema = {
  entities: {
    user: { fields: ["id", "name"], table: "users" },
    post: {
      fields: ["id", "score", "userId"],
      table: "posts",
      columns: { userId: "user_id" },
    },
    comment: {
      fields: ["id", "createdAt"],
      table: "comments",
      columns: { createdAt: "created_at" },
    },
  },
  joins: {
    "user.posts": { entity: "post", on: "posts.user_id = users.id", type: "many" },
    "post.comments": {
      entity: "comment",
      on: "comments.post_id = posts.id",
      type: "many",
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

    const ast = astFromJsonQuery(JSON.stringify(query), userTokensSchema);
    const plan = buildJoinPlan(
      ast,
      userTokensSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(shape(fixture.rows, ast.root, plan.joins)).toEqual(fixture.shaped);
  });

  it("user-with-tokens QL: equivalent AST and shaped result", () => {
    const ql = loadTextFixture("queries/user-with-tokens.ql");
    const json = loadFixture<Record<string, unknown>>("queries/user-with-tokens.json");
    const fixture = loadFixture<{
      rows: Record<string, unknown>[];
      shaped: Record<string, unknown>;
    }>("responses/user-with-tokens.json");

    const qlAst = astFromQlQuery(ql, userTokensSchema);
    const jsonAst = astFromJsonQuery(JSON.stringify(json), userTokensSchema);
    expect(qlAst).toEqual(jsonAst);

    const plan = buildJoinPlan(
      qlAst,
      userTokensSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );
    expect(shape(fixture.rows, qlAst.root, plan.joins)).toEqual(fixture.shaped);
  });

  it("post-comments-author: parser → planner → shaper", () => {
    const query = loadFixture<Record<string, unknown>>(
      "queries/post-comments-author.json",
    );
    const fixture = loadFixture<{
      rows: Record<string, unknown>[];
      shaped: Record<string, unknown>;
    }>("responses/post-comments-author.json");

    const ast = astFromJsonQuery(JSON.stringify(query), postCommentsSchema);
    const plan = buildJoinPlan(
      ast,
      postCommentsSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(shape(fixture.rows, ast.root, plan.joins)).toEqual(fixture.shaped);
  });

  it("nested-per-parent: planner picks nested strategy → nested shaper", () => {
    const query = loadFixture<Record<string, unknown>>("queries/nested-per-parent.json");
    const fixture = loadFixture<{
      rows: Record<string, unknown>[];
      shaped: Record<string, unknown>[];
    }>("responses/nested-per-parent.json");

    const { ast, read } = normalizeReadTree(
      parseJsonQuery(JSON.stringify(query)).root,
      userPostsSchema,
    );
    const plan = buildJoinPlan(
      ast,
      userPostsSchema,
      createQueryContext({ requestId: "1", method: "GET" }),
      { read },
    );

    expect(plan.strategy).toBe("nested");
    expect(shapeNested(fixture.rows, ast.root, plan, userPostsSchema)).toEqual(
      fixture.shaped,
    );
  });
});
