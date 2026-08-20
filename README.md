<p align="center">
  <img src="./assets/meshql-logo-mark.svg" alt="MeshQL logo" width="80" />
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
  <a href="./specs">Protocol specs</a> ·
  <a href="./docs/orm-adapters.md">ORM adapters</a> ·
  <a href="./docs/database-connections.md">DB connections</a> ·
  <a href="./docs/http-adapters.md">HTTP adapters</a> ·
  <a href="./docs/client.md">Client SDK</a> ·
  <a href="./examples/showcase">Showcase (full stack)</a> ·
  <a href="./examples/express-prisma">Prisma example</a>
</p>

<p align="center">
  <a href="https://jsr.io/@meshql/core"><img src="https://jsr.io/badges/@meshql/core" alt="JSR" /></a>
  <img src="https://img.shields.io/github/actions/workflow/status/meshql/meshql/ci.yml?branch=main&logo=github&label=CI" alt="CI" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white" alt="Node 22+" />
  <img src="https://img.shields.io/npm/v/@meshql-js/core?label=npm" alt="npm @meshql-js/core" />
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
| `@meshql/postgres` | [jsr.io/@meshql/postgres](https://jsr.io/@meshql/postgres) | Postgres `buildSelectSql` (`$1`, `$2`, … placeholders) |
| `@meshql/sqlite` | [jsr.io/@meshql/sqlite](https://jsr.io/@meshql/sqlite) | SQLite `buildSelectSql` for Node 22.5+ `node:sqlite` / Bun / D1 |
| `@meshql/http` | [jsr.io/@meshql/http](https://jsr.io/@meshql/http) | Express, Fastify, Hono adapters |
| `@meshql/client` | [jsr.io/@meshql/client](https://jsr.io/@meshql/client) | Typed client SDK |
| `@meshql/upload` | [jsr.io/@meshql/upload](https://jsr.io/@meshql/upload) | File uploads (optional) |
| `@meshql/integrity` | [jsr.io/@meshql/integrity](https://jsr.io/@meshql/integrity) | Request signing and integrity tokens |
| `@meshql/access` | [jsr.io/@meshql/access](https://jsr.io/@meshql/access) | Entity, row, and field access control |
| `@meshql/persisted-queries` | [jsr.io/@meshql/persisted-queries](https://jsr.io/@meshql/persisted-queries) | Persisted query IDs, `X-Mesh-Query-Id` transport (v0.8.0) |
| `@meshql/access-cache` | [jsr.io/@meshql/access-cache](https://jsr.io/@meshql/access-cache) | Cache permission results per user (v0.8.0) |
| `@meshql/prisma` | [jsr.io/@meshql/prisma](https://jsr.io/@meshql/prisma) | Prisma catch-all resolver (nested `select`) |
| `@meshql/drizzle` | [jsr.io/@meshql/drizzle](https://jsr.io/@meshql/drizzle) | Drizzle relational query resolver |
| `@meshql/kysely` | [jsr.io/@meshql/kysely](https://jsr.io/@meshql/kysely) | Kysely + `buildSelectSql` flat-row resolver |

**Core stack** (most apps — pick a DB adapter):

```bash
# SQLite (zero setup, built into Node 22.5+)
npx jsr add @meshql/core @meshql/sqlite @meshql/http @meshql/client

# Postgres
npx jsr add @meshql/core @meshql/postgres @meshql/http @meshql/client

# Prisma (catch-all ORM resolver)
npx jsr add @meshql/core @meshql/prisma @meshql/http @meshql/client
```

**With security** (signing + access):

```bash
npx jsr add @meshql/core @meshql/http @meshql/integrity @meshql/access
```

### npm (compiled ESM)

Packages publish on **npm** as **`@meshql-js/*`** (compiled `dist/`) and on **JSR** as **`@meshql/*`** (TypeScript source). Requires `"type": "module"` (or `.mjs`).

**Core stack:**

```bash
npm install @meshql-js/core @meshql-js/http @meshql-js/client
```

**Full stack** (uploads + security):

```bash
npm install @meshql-js/core @meshql-js/http @meshql-js/client @meshql-js/upload @meshql-js/integrity @meshql-js/access
```

| Package | npm | Purpose |
|---------|-----|---------|
| `@meshql-js/core` | [npmjs.com/package/@meshql-js/core](https://www.npmjs.com/package/@meshql-js/core) | Parser, planner, shaper, `createMesh()` |
| `@meshql-js/postgres` | [npmjs.com/package/@meshql-js/postgres](https://www.npmjs.com/package/@meshql-js/postgres) | Postgres `buildSelectSql` |
| `@meshql-js/sqlite` | [npmjs.com/package/@meshql-js/sqlite](https://www.npmjs.com/package/@meshql-js/sqlite) | SQLite `buildSelectSql` for `node:sqlite` / Bun / D1 |
| `@meshql-js/http` | [npmjs.com/package/@meshql-js/http](https://www.npmjs.com/package/@meshql-js/http) | Express, Fastify, Hono adapters |
| `@meshql-js/client` | [npmjs.com/package/@meshql-js/client](https://www.npmjs.com/package/@meshql-js/client) | Typed client SDK |
| `@meshql-js/upload` | [npmjs.com/package/@meshql-js/upload](https://www.npmjs.com/package/@meshql-js/upload) | File uploads (optional) |
| `@meshql-js/integrity` | [npmjs.com/package/@meshql-js/integrity](https://www.npmjs.com/package/@meshql-js/integrity) | Request signing and integrity tokens |
| `@meshql-js/access` | [npmjs.com/package/@meshql-js/access](https://www.npmjs.com/package/@meshql-js/access) | Entity, row, and field access control |
| `@meshql-js/persisted-queries` | [npmjs.com/package/@meshql-js/persisted-queries](https://www.npmjs.com/package/@meshql-js/persisted-queries) | Persisted query IDs, `X-Mesh-Query-Id` (v0.8.0) |
| `@meshql-js/access-cache` | [npmjs.com/package/@meshql-js/access-cache](https://www.npmjs.com/package/@meshql-js/access-cache) | Cache permission results per user (v0.8.0) |
| `@meshql-js/prisma` | [npmjs.com/package/@meshql-js/prisma](https://www.npmjs.com/package/@meshql-js/prisma) | Prisma catch-all resolver |
| `@meshql-js/drizzle` | [npmjs.com/package/@meshql-js/drizzle](https://www.npmjs.com/package/@meshql-js/drizzle) | Drizzle relational query resolver |
| `@meshql-js/kysely` | [npmjs.com/package/@meshql-js/kysely](https://www.npmjs.com/package/@meshql-js/kysely) | Kysely + SQL builder resolver |

Imports use the npm package names:

```typescript
import { createMesh } from "@meshql-js/core";
import { meshExpressRouter } from "@meshql-js/http/express";
import { createClient } from "@meshql-js/client";
import { integrityPlugin } from "@meshql-js/integrity";
import { accessPlugin } from "@meshql-js/access";
```

Or install from a [GitHub Release tarball](https://github.com/meshql/meshql/releases) (per-package tags like `npm/core/v*`):

```bash
npm install https://github.com/meshql/meshql/releases/download/npm/core/v0.1.4/meshql-js-core-0.1.4.tgz
```

See [CONTRIBUTING.md](./CONTRIBUTING.md#releasing-packages) for the release workflow (Changesets → per-package tags).

> **SQLite is first-class.** [`@meshql/sqlite`](./packages/sqlite) runs on Node 22.5+'s built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) — zero native deps, zero Docker. Try the [express-sqlite example](./examples/express-sqlite). Postgres works via [`@meshql/postgres`](./packages/postgres) and the [express-postgres example](./examples/express-postgres).

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
    user: { fields: ["id", "name"], table: "users" },
    token: {
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
Q=$(echo -n '{"user":{"$select":{"id":true,"name":true,"tokens":{"$select":{"accessToken":true}}}}}' | base64 | tr -d '\n')

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
  {
    user: {
      $select: {
        id: true,
        name: true,
        tokens: { $select: { accessToken: true } },
      },
    },
  },
  { entityId: "1" },
);
console.log(user);
```

### Collection queries and catch-all resolvers

**Collection reads** — use the same canonical query object as the wire payload:

```typescript
const users = await client.query(
  {
    user: {
      $select: { id: true, name: true },
      $page: { first: 10 },
      $orderBy: [{ field: "name", direction: "asc" }],
      $where: { field: "role", op: "eq", value: "admin" },
    },
  },
);
console.log(users.items, users.pageInfo);
```

**Catch-all resolver** — one handler for every entity (the pattern ORM adapters use):

```typescript
mesh.resolve("*", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.query(sql, params);
});
```

A specific `mesh.resolve("user", fn)` always wins over the `"*"` fallback.

### ORM adapters (v0.6.0+) and schema inference (v0.7.0)

Use your existing ORM client — MeshQL does not create database connections. See [docs/database-connections.md](./docs/database-connections.md).

**Prisma (infer schema from `schema.prisma`):**

```typescript
import { PrismaClient } from "@prisma/client";
import { createMesh } from "@meshql/core";
import { schemaFromPrisma, withPrisma } from "@meshql/prisma";

const prisma = new PrismaClient();
const schema = await schemaFromPrisma("./prisma/schema.prisma");
const mesh = createMesh(schema);
withPrisma(mesh, prisma, { schema });
```

**Drizzle** — `schemaFromDrizzle(tables)` + `withDrizzle(mesh, db, { schema })`.

**Kysely** — `withKysely(mesh, db, { schema, dialect: "postgres" })` runs `buildSelectSql` via `executeQuery`.

Full guide: [docs/orm-adapters.md](./docs/orm-adapters.md). Runnable demo: [express-prisma](./examples/express-prisma).

---

## Try the showcase

Interactive full-stack blog (**React** + `@meshql/client`) on SQLite — no Docker:

```bash
git clone https://github.com/meshql/meshql.git
cd meshql
pnpm install && pnpm build
pnpm --filter showcase start
```

Open **http://localhost:3010/** — the browser app uses `@meshql/client` against `/mesh/*` for login, reads, writes, and uploads. Check DevTools → Network to see signed MeshQL requests.

Optional CLI tour: `pnpm --filter showcase demo`

See [examples/showcase/README.md](./examples/showcase/README.md). Examples: [express-sqlite](./examples/express-sqlite), [express-postgres](./examples/express-postgres), [express-prisma](./examples/express-prisma).

---

## Server (with SQL)

Pick the adapter that matches your database. Both expose the same API.

**SQLite** (Node 22.5+ built-in, no Docker, no native deps):

```typescript
import { DatabaseSync } from "node:sqlite";
import { createMesh } from "@meshql/core";
import { buildSelectSql } from "@meshql/sqlite";
import { meshExpressRouter } from "@meshql/http/express";
import express from "express";

const db = new DatabaseSync(":memory:");
const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return db.prepare(sql).all(...params);
});

express()
  .use(express.json())
  .use(meshExpressRouter(mesh, "/mesh"))
  .listen(3001);
```

**Postgres** (via `pg`):

```typescript
import { createMesh } from "@meshql/core";
import { buildSelectSql } from "@meshql/postgres";
import { meshExpressRouter } from "@meshql/http/express";
import express from "express";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return (await pool.query(sql, params)).rows;
});

express()
  .use(express.json())
  .use(meshExpressRouter(mesh, "/mesh"))
  .listen(3001);
```

## Packages

| Package | npm | Purpose |
|---------|-----|---------|
| `@meshql/core` | `@meshql-js/core` | Parser, join planner, response shaper, `createMesh()` |
| `@meshql/postgres` | `@meshql-js/postgres` | `buildSelectSql` for Postgres |
| `@meshql/sqlite` | `@meshql-js/sqlite` | `buildSelectSql` for `node:sqlite` / Bun / D1 |
| `@meshql/http` | `@meshql-js/http` | Header transport + Express, Fastify, Hono adapters |
| `@meshql/client` | `@meshql-js/client` | Typed client, sets query headers for you |
| `@meshql/upload` | `@meshql-js/upload` | File uploads (optional) |
| `@meshql/integrity` | `@meshql-js/integrity` | Signing token lifecycle and request integrity |
| `@meshql/access` | `@meshql-js/access` | Entity, row, and dynamic field access |
| `@meshql/prisma` | `@meshql-js/prisma` | Prisma catch-all resolver |
| `@meshql/drizzle` | `@meshql-js/drizzle` | Drizzle relational query resolver |
| `@meshql/kysely` | `@meshql-js/kysely` | Kysely + SQL builder resolver |

HTTP adapter docs (routes, headers, curl): [docs/http-adapters.md](./docs/http-adapters.md)

ORM adapters: [docs/orm-adapters.md](./docs/orm-adapters.md) · DB connections: [docs/database-connections.md](./docs/database-connections.md)

**Protocol specs** (for language ports): [specs/](./specs) · [docs.meshql.dev/specs](https://docs.meshql.dev/specs)

Client SDK (browser, auth, uploads): [docs/client.md](./docs/client.md)

## Security

Built-in limits (depth, complexity, rate) live in `@meshql/core/builtins`. Custom plugins use `MeshPlugin` from `@meshql/core` and `mesh.use()`. For signed requests and access control, add the dedicated packages:

```bash
# npm
npm install @meshql-js/integrity @meshql-js/access

# JSR
npx jsr add @meshql/integrity @meshql/access
```

Runnable demo: [samples/npm-access](../samples/npm-access) in the meshql_stack repo.

> **JSR:** `integrity` and `access` require one-time package setup on [jsr.io](https://jsr.io) before first publish. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Hacking on it

Node 22+, pnpm 11. Monorepo uses Turborepo.

```
packages/core       engine (DB-agnostic)
packages/postgres   buildSelectSql for Postgres
packages/sqlite     buildSelectSql for node:sqlite / Bun / D1
packages/http       adapters
packages/client     SDK
packages/upload     uploads
packages/integrity  signing tokens
packages/access     access control
packages/prisma     Prisma adapter
packages/drizzle    Drizzle adapter
packages/kysely     Kysely adapter
examples/           runnable demos (express-sqlite, express-postgres, express-prisma)
```

### Testing

**260+ unit tests** across the monorepo (`pnpm test`). The engine is the focus:

| Package | Tests | Coverage highlights |
|---------|------:|---------------------|
| `@meshql/core` | 158 | JSON/QL parser, join planner, response shaper, spec [conformance fixtures](./specs/fixtures/) |
| `@meshql/postgres` | 19 | `buildSelectSql`, nested joins, cursor keyset |
| `@meshql/sqlite` | 31 | Same SQL builder contract as Postgres |
| Other packages | 52+ | HTTP transport, ORM adapters, integrity, access, persisted-queries, … |

Core tests exercise the full parse → plan → shape pipeline, including golden
queries from [`specs/fixtures/`](./specs/fixtures/) so alternative implementations
can match the published protocol.

```bash
pnpm test                  # all package unit tests (CI)
pnpm test:integration      # Postgres integration (requires Docker)
pnpm --filter @meshql/core test   # engine only
```

PRs welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

**Evaluating MeshQL?** See the [FAQ](./docs/faq.md) for GraphQL comparison, security, ORMs, and migration questions.

## License

MIT. Security issues: [SECURITY.md](./SECURITY.md).
