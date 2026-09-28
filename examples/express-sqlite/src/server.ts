import express from "express";
import { createMesh, type MeshSchema } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import { buildSelectSql } from "@meshql/sqlite";
import { db, ensureSchema, seed, type SqliteParam } from "./db.js";

const schema: MeshSchema = {
  entities: {
    user: {
      fields: ["id", "name"],
      table: "users",
    },
    token: {
      fields: ["accessToken", "expiresAt"],
      table: "tokens",
      columns: {
        accessToken: "access_token",
        expiresAt: "expires_at",
      },
    },
    post: {
      fields: ["id", "title", "score"],
      table: "posts",
    },
    comment: {
      fields: ["id", "body", "createdAt"],
      table: "comments",
      columns: { createdAt: "created_at" },
    },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
      table: "tokens",
    },
    "user.posts": {
      entity: "post",
      on: "posts.user_id = users.id",
      type: "many",
    },
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

ensureSchema();
seed();

const mesh = createMesh(schema);

mesh.resolve("*", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  if (process.env.LOG_SQL) {
    console.log(`\n[${plan.strategy}] ${sql}\n  params: ${JSON.stringify(params)}`);
  }
  return db.prepare(sql).all(...(params as SqliteParam[]));
});

const app = express();
app.use(express.json());
app.use(meshExpressRouter(mesh, "/mesh"));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    storage: process.env.SQLITE_FILE ? `sqlite:${process.env.SQLITE_FILE}` : "sqlite::memory:",
  });
});

const port = Number(process.env.PORT ?? 3003);
app.listen(port, () => {
  console.log(`MeshQL SQLite example listening on http://localhost:${port}`);
  console.log("Storage: node:sqlite —", process.env.SQLITE_FILE ?? ":memory: (lost on restart)");
  console.log("Try:    pnpm --filter express-sqlite demo");
  console.log("        pnpm --filter express-sqlite demo:nested");
});
