import { createMesh, type MeshSchema } from "@meshql/core";
import { withBasicIntegrity, withRoleAccess, depthLimit } from "@meshql/core/builtins";
import { buildSelectSql } from "@meshql/postgres";
import { withIntegrity } from "@meshql/integrity";
import { meshIntegrityExpressRouter } from "@meshql/integrity/express";
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
const useIntegrity = process.env.MESH_INTEGRITY === "1";

if (useIntegrity && process.env.MESH_SECRET) {
  withIntegrity(mesh, {
    secret: process.env.MESH_SECRET,
    tokenTTL: "15m",
    authenticate: async (credentials) => {
      const body = credentials as { email?: string; password?: string };
      if (body.email === "demo@example.com" && body.password === "demo") {
        return {
          userId: "user-1",
          sessionId: crypto.randomUUID(),
          role: "admin",
        };
      }
      throw new Error("Invalid credentials");
    },
  });
} else if (process.env.MESH_SECRET) {
  withBasicIntegrity(mesh, { secret: process.env.MESH_SECRET });
  withRoleAccess(mesh, {
    rules: {
      "user.tokens.accessToken": (ctx) => ctx.role === "admin",
    },
  });
  mesh.use(depthLimit({ max: 5 }));
}

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

if (useIntegrity && process.env.MESH_SECRET && "integrity" in mesh) {
  app.use(
    meshIntegrityExpressRouter(
      mesh,
      (mesh as typeof mesh & { integrity: import("@meshql/integrity").IntegrityConfig })
        .integrity,
      "/mesh",
    ),
  );
} else {
  app.use(meshExpressRouter(mesh, "/mesh"));
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    storage: pool ? "postgres" : "in-memory",
    security: process.env.MESH_SECRET
      ? useIntegrity
        ? "integrity"
        : "basic"
      : "disabled",
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
    console.log(
      `Security: ${
        process.env.MESH_SECRET
          ? useIntegrity
            ? "integrity (POST /mesh/auth)"
            : "basic HMAC"
          : "disabled"
      }`,
    );
    console.log("Try: pnpm --filter express-postgres exec tsx src/demo-client.ts");
    if (useIntegrity) {
      console.log(
        "Secure: pnpm --filter express-postgres exec tsx src/demo-secure-client.ts",
      );
    }
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
