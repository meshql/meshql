# Run MeshQL in 5 minutes

Get a working MeshQL stack — reads, signed auth, list queries, and uploads — with **no Docker**.

MeshQL is published on **[JSR](https://jsr.io/@meshql)** (`@meshql/*`) and **[npm](https://www.npmjs.com/package/meshql-core)** (`meshql-*`). Current release line: **0.7.x**.

---

## Fastest path — interactive showcase

Full-stack blog demo (**React** + `@meshql/client` on SQLite):

```bash
git clone https://github.com/meshql/meshql.git
cd meshql
pnpm install && pnpm build
pnpm --filter showcase start
```

Open **http://localhost:3010/** — sign in with `ada@example.com` / `demo` and watch DevTools → Network for `/mesh/*` calls.

Optional CLI tour of the same API:

```bash
pnpm --filter showcase demo
```

See [examples/showcase/README.md](../examples/showcase/README.md).

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

---

## Step 2 — Install MeshQL

**JSR:**

```bash
npx jsr add @meshql/core @meshql/sqlite @meshql/http @meshql/client @meshql/integrity
```

**npm:**

```bash
npm install meshql-core meshql-sqlite meshql-http meshql-client meshql-integrity
```

Add Express:

```bash
npm i express
npm i -D @types/express   # Node only
```

---

## Step 3 — Minimal SQLite server

Uses Node 22.5+ built-in `node:sqlite` — no native deps.

```typescript
// src/index.ts
import { DatabaseSync } from "node:sqlite";
import { createMesh, type MeshSchema } from "@meshql/core";
import { buildSelectSql } from "@meshql/sqlite";
import { meshIntegrityExpressRouter } from "@meshql/integrity/express";
import { withIntegrity } from "@meshql/integrity";
import express from "express";

const schema: MeshSchema = {
  entities: {
    user: { type: {}, fields: ["id", "name", "email"], table: "users" },
  },
  joins: {},
};

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);
  INSERT INTO users VALUES (1, 'Ada Lovelace', 'ada@example.com');
`);

const base = createMesh(schema);
const mesh = withIntegrity(base, {
  secret: process.env.MESH_SECRET ?? "dev-secret",
  authenticate: async (creds) => {
    const { email } = creds as { email?: string };
    const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email ?? "") as
      | { id: number }
      | undefined;
    if (!row) throw new Error("Invalid credentials");
    return { userId: String(row.id), sessionId: crypto.randomUUID(), role: "user" };
  },
});

mesh.resolve("*", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...params);
});

const app = express();
app.use(express.json());
app.use(meshIntegrityExpressRouter(mesh, mesh.integrity, "/mesh"));

app.listen(3001, () => {
  console.log("MeshQL on http://localhost:3001/mesh");
});
```

Run:

```bash
npx tsx src/index.ts
```

---

## Step 4 — Test with the client SDK

```typescript
// src/client-demo.ts
import { createAuthClient } from "@meshql/client";

const client = createAuthClient({ url: "http://localhost:3001/mesh", format: "json" });

await client.login({ email: "ada@example.com" });

// Point read
const user = await client.query(
  { user: { id: true, name: true, email: true } },
  { entityId: "1" },
);
console.log("user:", user);

// List read ($list in signed payload)
const users = await client.query(
  { user: { id: true, name: true } },
  { list: { limit: 10, orderBy: [{ field: "id", dir: "asc" }] } },
);
console.log("list:", users);
```

```bash
npx tsx src/client-demo.ts
```

See [client.md](./client.md) for browser usage, uploads, and React integration.

---

## Step 5 — Test with curl

### Login (integrity)

```bash
curl -s -X POST http://localhost:3001/mesh/auth \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com"}'
```

Save `signingToken` and `token` from the response for signed queries.

### Signed GET (manual)

Base64-encode the query JSON:

```bash
mesh_query() {
  echo -n "$1" | base64 | tr -d '\n'
}

Q=$(mesh_query '{"user":{"id":true,"name":true}}')

# Sign with your signingToken (see @meshql/http signQuery or use the client)
curl -s "http://localhost:3001/mesh/user/1" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json" \
  -H "X-Mesh-Token: $TOKEN" \
  -H "X-Mesh-Signature: sha256=..."
```

Prefer `@meshql/client` — it handles encoding and signing automatically.

### List with `$list`

```bash
Q=$(mesh_query '{"user":{"id":true,"name":true},"$list":{"limit":10}}')

curl -s "http://localhost:3001/mesh/user" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json" \
  -H "X-Mesh-Token: $TOKEN" \
  -H "X-Mesh-Signature: sha256=..."
```

List options live in the signed payload, not URL query strings.

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

## Other examples

| Example | Stack | Highlights |
|---------|-------|------------|
| [showcase](../examples/showcase) | React + SQLite + integrity + access + uploads | Full dashboard, browser client |
| [express-sqlite](../examples/express-sqlite) | Express + SQLite | Minimal SQL adapter |
| [express-postgres](../examples/express-postgres) | Express + Postgres + uploads | Avatar upload demo |

---

## Related

- [HTTP adapters](./http-adapters.md) — routes, headers, uploads, errors
- [Client SDK](./client.md) — browser, auth, list queries, uploads
- [README](../README.md) — project overview
