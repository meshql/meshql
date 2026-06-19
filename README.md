<p align="center">
  <img src="./assets/meshql-logo.png" alt="MeshQL logo" width="80" />
</p>

<h1 align="center">MeshQL</h1>

<p align="center">
  <strong>Shape your API, not your codebase.</strong><br />
  Client-driven field selection over REST, without GraphQL ceremony.
</p>

<p align="center">
  <a href="https://github.com/meshql/meshql">GitHub</a> ·
  <a href="https://jsr.io/@meshql/core">JSR</a> ·
  <a href="./docs/run-example.md">5-minute guide</a> ·
  <a href="./docs/http-adapters.md">HTTP adapters</a> ·
  <a href="./examples/express-postgres">Example</a>
</p>

<p align="center">
  <a href="https://jsr.io/@meshql/core"><img src="https://jsr.io/badges/@meshql/core" alt="JSR" /></a>
  <img src="https://img.shields.io/github/actions/workflow/status/meshql/meshql/ci.yml?branch=main&logo=github&label=CI" alt="CI" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white" alt="Node 22+" />
  <img src="https://img.shields.io/npm/v/meshql-core?label=npm" alt="npm meshql-core" />
  <img src="https://img.shields.io/github/license/meshql/meshql" alt="MIT" />
</p>

---

MeshQL is a small TypeScript library for when you want GraphQL-style "give me these fields" queries, but you'd rather keep REST and write normal SQL.

Clients send a query (what fields they want, including nested stuff like `user.tokens.accessToken`). You get a `JoinPlan` with exactly those fields and joins. Write one query, return flat rows, MeshQL shapes the JSON. No resolver per field, no dataloader dance, no codegen eating your types.

## Install

### JSR (TypeScript source)

Published on **[JSR](https://jsr.io/@meshql)** under the `@meshql` scope.

```bash
# Node
npx jsr add @meshql/core @meshql/http @meshql/client

# Bun
bunx jsr add @meshql/core @meshql/http @meshql/client

# Deno
deno add jsr:@meshql/core jsr:@meshql/http jsr:@meshql/client
```

| Package | JSR | Purpose |
|---------|-----|---------|
| `@meshql/core` | [jsr.io/@meshql/core](https://jsr.io/@meshql/core) | Parser, planner, shaper, `createMesh()` |
| `@meshql/http` | [jsr.io/@meshql/http](https://jsr.io/@meshql/http) | Express, Fastify, Hono adapters |
| `@meshql/client` | [jsr.io/@meshql/client](https://jsr.io/@meshql/client) | Typed client SDK |
| `@meshql/upload` | [jsr.io/@meshql/upload](https://jsr.io/@meshql/upload) | File uploads (optional) |

### npm (compiled ESM)

Until the `@meshql` npm org is available, packages publish as unscoped **`meshql-*`** with compiled `dist/`. Requires `"type": "module"` (or `.mjs`).

```bash
npm install meshql-core meshql-http meshql-client
```

| Package | npm | Purpose |
|---------|-----|---------|
| `meshql-core` | [npmjs.com/package/meshql-core](https://www.npmjs.com/package/meshql-core) | Parser, planner, shaper, `createMesh()` |
| `meshql-http` | [npmjs.com/package/meshql-http](https://www.npmjs.com/package/meshql-http) | Express, Fastify, Hono adapters |
| `meshql-client` | [npmjs.com/package/meshql-client](https://www.npmjs.com/package/meshql-client) | Typed client SDK |
| `meshql-upload` | [npmjs.com/package/meshql-upload](https://www.npmjs.com/package/meshql-upload) | File uploads (optional) |

Or install from a [GitHub Release tarball](https://github.com/meshql/meshql/releases) (tag `npm/core/v*`, etc.):

```bash
npm install https://github.com/meshql/meshql/releases/download/npm/core/v0.1.2/meshql-core-0.1.2.tgz
```

See [CONTRIBUTING.md](./CONTRIBUTING.md#publishing-to-npm-interim) for release tags (`npm/core/v0.1.2`, `npm/all/v0.1.2`).

> **v0.1.x is pre-security** — HMAC, integrity tokens, and access plugins are in the monorepo but not yet on JSR. See [Security (coming soon)](#security-coming-soon).

> **SQLite is not supported.** Use in-memory data for local testing, or Postgres via the [express-postgres example](./examples/express-postgres).

---

## Quick start in 5 steps

Full walkthrough with Express, Hono, and Bun: **[docs/run-example.md](./docs/run-example.md)**

### 1. Init a project

```bash
mkdir my-meshql-app && cd my-meshql-app
npm init -y && npm pkg set type=module
npm i -D typescript tsx @types/node
npx jsr add @meshql/core @meshql/http
npm i express
mkdir src
```

### 2. Create `src/index.ts`

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

const mesh = createMesh(schema);
mesh.resolve("user", async () => [
  { user_id: 1, user_name: "Ada Lovelace", tokens_accessToken: "tok_ada" },
]);

const app = express();
app.use(express.json());
app.use(meshExpressRouter(mesh, "/mesh"));
app.listen(3001, () => console.log("http://localhost:3001/mesh"));
```

### 3. Start the server

```bash
npx tsx src/index.ts
```

### 4. Test with curl

```bash
Q=$(echo -n '{"user":{"id":true,"name":true,"tokens":{"accessToken":true}}}' | base64 | tr -d '\n')

curl -s "http://localhost:3001/mesh/user/1" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json"
```

### 5. Or use the client SDK

```bash
npx jsr add @meshql/client
```

```typescript
import { createClient } from "@meshql/client";

const client = createClient({ url: "http://localhost:3001/mesh" });
const user = await client.query(
  { user: { id: true, name: true, tokens: { accessToken: true } } },
  { entityId: "1" },
);
console.log(user);
```

---

## Try the monorepo example

For contributors, Postgres, and future security demos:

```bash
git clone https://github.com/meshql/meshql.git
cd meshql
pnpm install && pnpm build
pnpm --filter express-postgres start
```

In another terminal:

```bash
pnpm --filter express-postgres exec tsx src/demo-client.ts
```

Works **without Postgres** (in-memory). See [examples/express-postgres/README.md](./examples/express-postgres/README.md).

---

## Server (with SQL)

```typescript
import { createMesh, buildSelectSql } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import express from "express";

const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return (await pool.query(sql, params)).rows;
});

const app = express();
app.use(meshExpressRouter(mesh, "/mesh"));
app.listen(3001);
```

## Packages

- `@meshql/core` — parser, join planner, response shaper, `createMesh()`, `buildSelectSql()`
- `@meshql/http` — header transport + adapters for Express, Fastify, Hono
- `@meshql/client` — typed client, sets query headers for you
- `@meshql/upload` — file uploads (optional)

HTTP adapter docs (routes, headers, curl): [docs/http-adapters.md](./docs/http-adapters.md)

## Security (coming soon)

v0.1.x on JSR does **not** include signing or access control packages yet. The monorepo has:

- `@meshql/core/builtins` — basic HMAC, role access, depth/complexity limits
- `@meshql/integrity` — signing token lifecycle
- `@meshql/access` — entity, row, and dynamic field access

These will ship to JSR in a future release.

## Hacking on it

Node 22+, pnpm 11. Monorepo uses Turborepo.

```
packages/core      engine
packages/http      adapters
packages/client    SDK
packages/upload    uploads
examples/          runnable demos
```

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT. Security issues: [SECURITY.md](./SECURITY.md).
