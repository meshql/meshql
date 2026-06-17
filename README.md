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
  <a href="./docs/http-adapters.md">HTTP adapters</a> ·
  <a href="./examples/express-postgres">Example</a>
</p>

<p align="center">
  <img src="https://img.shields.io/github/actions/workflow/status/meshql/meshql/ci.yml?branch=main&logo=github&label=CI" alt="CI" />
  <img src="https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=white" alt="Node 22+" />
  <img src="https://img.shields.io/badge/typescript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/github/license/meshql/meshql" alt="MIT" />
</p>

---

MeshQL is a small TypeScript library for when you want GraphQL-style "give me these fields" queries, but you'd rather keep REST and write normal SQL.

Clients send a query (what fields they want, including nested stuff like `user.tokens.accessToken`). You get a `JoinPlan` with exactly those fields and joins. Write one query, return flat rows, MeshQL shapes the JSON. No resolver per field, no dataloader dance, no codegen eating your types.

## The idea

GraphQL is great until you're maintaining 40 resolvers and debugging N+1 queries at 2am.

Plain REST is great until every client wants a slightly different `?include=` and you're shipping half the database anyway.

MeshQL sits in the middle. URLs stay normal REST (`GET /mesh/user/123`). The query lives in a header (`X-Mesh-Query`), base64-encoded so you don't fight URL length limits. The client SDK handles encoding; you don't think about it.

## Try it

```bash
git clone https://github.com/meshql/meshql.git
cd meshql
pnpm install
pnpm build
pnpm test
```

Run the example server:

```bash
pnpm --filter express-postgres start
```

Then in another terminal:

```bash
pnpm --filter express-postgres exec tsx src/demo-client.ts
```

Works without Postgres (in-memory). Set `DATABASE_URL` if you want the real thing. See `examples/express-postgres`.

## Server

```typescript
import { createMesh, buildSelectSql } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import express from "express";

const schema = {
  entities: {
    user: { type: {} as User, fields: ["id", "name"], table: "users" },
    token: {
      type: {} as Token,
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

mesh.resolve("user", async (plan) => {
  // plan.fields and plan.joins = only what the client asked for
  const { sql, params } = buildSelectSql(plan, schema);
  return (await pool.query(sql, params)).rows;
});

const app = express();
app.use(meshExpressRouter(mesh, "/mesh"));
app.listen(3001);
```

## Client

```typescript
import { createClient } from "@meshql/client";

const client = createClient({ url: "http://localhost:3001/mesh" });

const user = await client.query(
  {
    user: {
      id: true,
      name: true,
      tokens: { accessToken: true },
    },
  },
  { entityId: "123" },
);
```

## Packages

- `@meshql/core` - parser, join planner, response shaper, `createMesh()`, `buildSelectSql()`
- `@meshql/http` - header transport + adapters for Express, Fastify, Hono
- `@meshql/client` - typed client, sets query headers for you
- `@meshql/upload` - file uploads (optional, separate package)

HTTP adapter docs (routes, headers, per-framework setup): [docs/http-adapters.md](./docs/http-adapters.md)

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
