import { createMesh, type JoinPlan, type MeshPlugin } from "@meshql/core";
import { depthLimit } from "@meshql/core/builtins";
import { withAccess } from "@meshql/access";
import { withIntegrity } from "@meshql/integrity";
import { buildSelectSql } from "@meshql/sqlite";
import { withUpload } from "@meshql/upload";
import { db, ensureSchema, seed, type SqliteParam } from "./db.js";
import { schema } from "./schema.js";

export const SECRET = process.env.MESH_SECRET ?? "showcase-secret";

ensureSchema();
seed();

const base = withUpload(createMesh(schema), {
  storage: "local",
  localDirectory: "./uploads",
});

export const mesh = withIntegrity(base, {
  secret: SECRET,
  tokenTTL: "1h",
  authenticate: async (credentials) => {
    const body = credentials as { email?: string; password?: string };
    const row = db
      .prepare("SELECT id, role, password FROM users WHERE email = ?")
      .get(body.email ?? "") as
      | { id: number; role: string; password: string }
      | undefined;

    if (!row || row.password !== body.password) {
      throw new Error("Invalid credentials");
    }

    return {
      userId: String(row.id),
      sessionId: crypto.randomUUID(),
      role: row.role,
    };
  },
});

withAccess(mesh, {
  rules: {
    "user.email": (ctx) => ctx.role === "admin",
  },
  rowAccess: {
    post: async (ctx, entityId) => {
      if (ctx.role === "admin" || ctx.role === "author") return true;
      const row = db
        .prepare("SELECT status FROM posts WHERE id = ?")
        .get(Number(entityId)) as { status: string } | undefined;
      return row?.status === "published";
    },
  },
});

const guestPostFilter: MeshPlugin = {
  name: "guest-post-filter",
  onPlan(plan, ctx) {
    if (plan.rootEntity !== "post") return plan;
    if (ctx.queryContext.role === "admin" || ctx.queryContext.role === "author") {
      return plan;
    }
    if (plan.context.entityId !== undefined) return plan;

    return {
      ...plan,
      list: {
        ...plan.list,
        filter: [
          ...(plan.list?.filter ?? []),
          { field: "status", op: "eq", value: "published" },
        ],
      },
    };
  },
};

mesh.use(guestPostFilter);
mesh.use(depthLimit({ max: 5 }));

mesh.resolve("*", async (plan: JoinPlan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...(params as SqliteParam[]));
});

mesh.resolveUpload("user.avatar", async (file, plan) => {
  const entityId = plan.context.entityId ?? "new";
  const key = `user/${entityId}/${file.originalName}`;
  const stored = await base.upload.adapter.put(file, key);

  if (plan.context.entityId !== undefined) {
    db.prepare("UPDATE users SET avatar = ? WHERE id = ?").run(
      stored,
      Number(plan.context.entityId),
    );
  }

  return { avatar: stored };
});

export { base };
