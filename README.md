<p align="center">
  <img src="./assets/meshql-logo.png" alt="MeshQL logo" width="80" />
</p>

<h1 align="center">MeshQL</h1>

<p align="center">
  <strong>Shape your API, not your codebase.</strong><br />
  Client-driven field selection over REST — without GraphQL ceremony.
</p>

<p align="center">
  <a href="https://github.com/meshql/meshql">GitHub</a> ·
  <a href="./docs/http-adapters.md">HTTP adapters</a> ·
  <a href="./examples/express-postgres">Example</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/meshql/meshql/ci.yml?branch=main&logo=github&label=CI" alt="CI" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white" alt="Node 22+" />
  <img src="https://img.shields.io/github/license/meshql/meshql" alt="MIT" />
</p>

---

## What is MeshQL?

A TypeScript library for **REST APIs with GraphQL-style queries**. Clients pick the shape; you write **one SQL query per request** — no per-field resolvers, dataloaders, or codegen.

| From | You get |
|------|---------|
| **GraphQL** | Client-driven field selection, nested relations |
| **REST** | HTTP verbs, cacheable URLs |
| **Your schema** | Typed join config — your domain types stay untouched |

---

## Quick example

```typescript
import { createMesh, buildSelectSql } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import { createClient } from "@meshql/client";
import express from "express";

const schema = {
  entities: {
    user:  { type: {} as User,  fields: ["id", "name"], table: "users" },
    token: { type: {} as Token, fields: ["accessToken"], table: "tokens",
             columns: { accessToken: "access_token" } },
  },
  joins: {
    "user.tokens": { entity: "token", on: "tokens.user_id = users.id", type: "many" },
  },
};

const mesh = createMesh(schema);

mesh.resolve("user", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  return (await pool.query(sql, params)).rows;
});

express().use(meshExpressRouter(mesh, "/mesh")).listen(3001);

// Client
const client = createClient({ url: "http://localhost:3001/mesh" });
const user = await client.query(
  { user: { id: true, name: true, tokens: { accessToken: true } } },
  { entityId: "123" },
);
```

---

## Packages

| Package | Purpose |
|---------|---------|
| [`@meshql/core`](./packages/core) | Parser, planner, shaper, `createMesh()`, `buildSelectSql()` |
| [`@meshql/http`](./packages/http) | HTTP transport — [Express, Fastify, Hono](./docs/http-adapters.md) |
| [`@meshql/client`](./packages/client) | Typed client (handles query headers for you) |
| [`@meshql/upload`](./packages/upload) | Opt-in file upload extension |

---

## Documentation

| Doc | Contents |
|-----|----------|
| [HTTP adapters](./docs/http-adapters.md) | Routes, headers, Express / Fastify / Hono setup, errors |
| [Contributing](./CONTRIBUTING.md) | Dev setup and PR guidelines |

---

## Development

```bash
git clone https://github.com/meshql/meshql.git && cd meshql
pnpm install && pnpm build && pnpm test
```

Run the [express-postgres example](./examples/express-postgres):

```bash
pnpm --filter express-postgres start
pnpm --filter express-postgres exec tsx src/demo-client.ts
```

---

## License

MIT © [MeshQL](https://github.com/meshql/meshql) · [Security](./SECURITY.md) · [Changelog](./CHANGELOG.md)
