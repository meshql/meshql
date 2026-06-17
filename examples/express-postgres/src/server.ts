import { createMesh, buildSelectSql, type MeshSchema } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import express from "express";
import type { User, Token } from "./types.js";
import { ensureSchema, pool } from "./db.js";
import { inMemoryRows, queryInMemory } from "./data.js";

const schema: MeshSchema = {
  entities: {
    user: {
      type: {} as User,
      fields: ["id", "name"],
      table: "users",
    },
    token: {
      type: {} as Token,
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

const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);

  if (pool) {
    const result = await pool.query(sql, params);
    return result.rows;
  }

  console.log("[meshql] SQL:", sql, params);
  return queryInMemory(plan, inMemoryRows);
});

const app = express();
app.use(express.json());
app.use(meshExpressRouter(mesh, "/mesh"));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    storage: pool ? "postgres" : "in-memory",
  });
});

const port = Number(process.env.PORT ?? 3001);

async function start() {
  if (pool) {
    await ensureSchema();
  }

  app.listen(port, () => {
    console.log(`MeshQL example listening on http://localhost:${port}`);
    console.log(`Storage: ${pool ? "postgres" : "in-memory"}`);
    console.log("Try: pnpm --filter express-postgres exec tsx src/demo-client.ts");
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
