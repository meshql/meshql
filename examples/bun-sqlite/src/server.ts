import { Hono } from "hono";
import { createMesh, type MeshSchema } from "@meshql/core";
import { meshHonoRoutes } from "@meshql/http/hono";
import { buildSelectSql } from "@meshql/sqlite";
import { db, ensureSchema, seed } from "./db.ts";

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
  return db.query(sql).all(...params);
});

const app = new Hono();
app.get("/health", (c) =>
  c.json({
    ok: true,
    storage: process.env.SQLITE_FILE
      ? `sqlite:${process.env.SQLITE_FILE}`
      : "sqlite::memory:",
  }),
);
app.route("/", meshHonoRoutes(mesh, { basePath: "/mesh" }));

const port = Number(process.env.PORT ?? 3004);

export default {
  port,
  fetch: app.fetch,
};

console.log(`MeshQL Bun SQLite example on http://localhost:${port}`);
console.log("Storage: bun:sqlite —", process.env.SQLITE_FILE ?? ":memory: (lost on restart)");
console.log("Try:    pnpm --filter bun-sqlite demo");
