# Run MeshQL in 5 minutes

Get a working MeshQL server with **no database** — then test it with **curl**.

MeshQL is published on [JSR](https://jsr.io/@meshql) (`@meshql` scope). **npm packages are coming soon** — use JSR for now. Version **0.1.x** is pre-security (no HMAC or signing tokens yet).

> **SQLite is not supported.** Use in-memory data for local testing (below), or Postgres via the [express-postgres example](../examples/express-postgres).

---

## Step 1 — Create a project

### Node (npm)

```bash
mkdir my-meshql-app && cd my-meshql-app
npm init -y
npm pkg set type=module
npm i -D typescript tsx @types/node
npx tsc --init --module nodenext --moduleResolution nodenext --target ES2022 --outDir dist --rootDir src
mkdir src
```

### Bun

```bash
mkdir my-meshql-app && cd my-meshql-app
bun init -y
mkdir src
```

### Deno

```bash
mkdir my-meshql-app && cd my-meshql-app
deno init
```

---

## Step 2 — Install MeshQL from JSR

```bash
# npm
npx jsr add @meshql/core @meshql/http @meshql/client

# Bun
bunx jsr add @meshql/core @meshql/http @meshql/client

# Deno
deno add jsr:@meshql/core jsr:@meshql/http jsr:@meshql/client
```

Install a framework:

| Stack | Command |
|-------|---------|
| Express | `npm i express` (+ `npm i -D @types/express` on Node) |
| Hono (Node) | `npm i hono @hono/node-server` |
| Hono (Bun) | `bun add hono` |

---

## Step 3 — Paste a server

All examples use **in-memory data** — no database required.

### Express (`src/index.ts`)

```typescript
import { createMesh, type MeshSchema } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import express from "express";

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

const rows = [
  { user_id: 1, user_name: "Ada Lovelace", tokens_accessToken: "tok_ada" },
  { user_id: 2, user_name: "Grace Hopper", tokens_accessToken: "tok_grace" },
];

const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  let result = [...rows];
  if (plan.context.entityId) {
    const id = Number(plan.context.entityId);
    result = result.filter((r) => r.user_id === id);
  }
  return result;
});

const app = express();
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(meshExpressRouter(mesh, "/mesh"));

app.listen(3001, () => {
  console.log("MeshQL on http://localhost:3001/mesh");
});
```

### Hono (`src/index.ts`)

```typescript
import { Hono } from "hono";
import { createMesh, type MeshSchema } from "@meshql/core";
import { meshHonoRoutes } from "@meshql/http/hono";

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

const rows = [
  { user_id: 1, user_name: "Ada Lovelace", tokens_accessToken: "tok_ada" },
  { user_id: 2, user_name: "Grace Hopper", tokens_accessToken: "tok_grace" },
];

const mesh = createMesh(schema);
mesh.resolve("user", async (plan) => {
  let result = [...rows];
  if (plan.context.entityId) {
    const id = Number(plan.context.entityId);
    result = result.filter((r) => r.user_id === id);
  }
  return result;
});

const app = new Hono();
app.get("/health", (c) => c.json({ ok: true }));
app.route("/", meshHonoRoutes(mesh, { basePath: "/mesh" }));

export default app;
```

Run on Node with `@hono/node-server`:

```typescript
import { serve } from "@hono/node-server";
import app from "./index.js";

serve({ fetch: app.fetch, port: 3001 }, () => {
  console.log("MeshQL on http://localhost:3001/mesh");
});
```

Or on Bun — add to the bottom of `index.ts`:

```typescript
export default { port: 3001, fetch: app.fetch };
```

---

## Step 4 — Start the server

```bash
# Node
npx tsx src/index.ts

# Bun
bun run src/index.ts

# Deno
deno run --allow-net src/index.ts
```

Check health:

```bash
curl -s http://localhost:3001/health
# {"ok":true}
```

---

## Step 5 — Test with curl

MeshQL queries travel in headers on `GET` requests. Base64-encode the query JSON:

```bash
# Helper — add to your shell or run inline
mesh_query() {
  echo -n "$1" | base64 | tr -d '\n'
}
```

### Get one user (with nested tokens)

```bash
Q=$(mesh_query '{"user":{"id":true,"name":true,"tokens":{"accessToken":true}}}')

curl -s "http://localhost:3001/mesh/user/1" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json"
```

Expected:

```json
{
  "id": 1,
  "name": "Ada Lovelace",
  "tokens": [{ "accessToken": "tok_ada" }]
}
```

### List all users

```bash
curl -s "http://localhost:3001/mesh/user" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json"
```

### QL format (brace syntax)

```bash
Q=$(mesh_query '{ user { id name tokens { accessToken } } }')

curl -s "http://localhost:3001/mesh/user/1" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: ql"
```

### POST (query in body — no base64)

```bash
curl -s -X POST "http://localhost:3001/mesh" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ user { id name } }","format":"ql"}'
```

### Missing header (expected error)

```bash
curl -s "http://localhost:3001/mesh/user/1"
```

```json
{
  "error": "TransportError",
  "message": "Missing X-Mesh-Query header"
}
```

---

## Optional — client SDK

```typescript
import { createClient } from "@meshql/client";

const client = createClient({ url: "http://localhost:3001/mesh" });

const user = await client.query(
  { user: { id: true, name: true, tokens: { accessToken: true } } },
  { entityId: "1" },
);

console.log(user);
```

Run with `npx tsx client.ts` (or `bun run client.ts`).

---

## Optional — full monorepo example (Postgres)

For Postgres, seeded data, and future security demos:

```bash
git clone https://github.com/meshql/meshql.git
cd meshql
pnpm install && pnpm build
pnpm --filter express-postgres start
```

See [examples/express-postgres/README.md](../examples/express-postgres/README.md).

---

## Related

- [HTTP adapters](./http-adapters.md) — routes, headers, errors
- [JSR packages](https://jsr.io/@meshql/core)
