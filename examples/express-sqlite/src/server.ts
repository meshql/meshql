import express from "express";
import { createMesh, type MeshSchema } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import { buildSelectSql } from "@meshql/sqlite";
import { db, ensureSchema, seed, type SqliteParam } from "./db.js";

const schema: MeshSchema = {
  entities: {
    user: {
      type: {} as { id: number; name: string },
      fields: ["id", "name"],
      table: "users",
    },
    token: {
      type: {} as { accessToken: string; expiresAt: string },
      fields: ["accessToken", "expiresAt"],
      table: "tokens",
      columns: {
        accessToken: "access_token",
        expiresAt: "expires_at",
      },
    },
  },
  joins: {
    "user.tokens": {
      entity: "token",
      on: "tokens.user_id = users.id",
      type: "many",
      table: "tokens",
    },
  },
};

ensureSchema();
seed();

const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
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
});
