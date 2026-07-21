# @meshql/docs

Interactive API docs and query playground for MeshQL — like Swagger UI or GraphQL Playground, served from your app.

## Install

```bash
npx jsr add @meshql/docs
# or
npm install meshql-docs
```

## Quick start (Express)

```ts
import express from "express";
import { createMesh } from "@meshql/core";
import { withDocs } from "@meshql/docs";
import { meshDocsExpressRouter } from "@meshql/docs/express";
import { meshExpressRouter } from "@meshql/http/express";

const mesh = createMesh(schema);
// ... resolvers, plugins

export const appMesh = withDocs(mesh, {
  path: "/docs",
  title: "My API",
  sql: "dev",
});

const app = express();
app.use(meshDocsExpressRouter(appMesh, appMesh.docs, "/docs"));
app.use("/api", meshExpressRouter(appMesh, "/api"));
app.listen(3000);
```

Open `http://localhost:3000/docs` — entity browser, query builder, live responses, and SQL trace (dev mode).

## Routes

| Route | Description |
|---|---|
| `GET /docs` | Playground UI |
| `GET /docs/schema` | JSON introspection (`SchemaDoc`) |
| `POST /docs/execute` | Run a query (`{ data, meta }`) |

## Options

| Option | Default | Description |
|---|---|---|
| `path` | `/docs` | URL prefix |
| `title` | — | Shown in playground header + schema doc |
| `theme` | `dark` | `dark` or `light` |
| `auth` | `false` | `false`, `"admin"`, or `(ctx) => boolean` |
| `sql` | dev-only | `"dev"` shows SQL panel; `false` hides it |
| `entities` | all | Allowlist of entity names |

## SQL trace

Enable `sql: "dev"` and use `recordPlanSql` in SQL resolvers (or `@meshql/kysely` / showcase patterns):

```ts
import { recordPlanSql } from "@meshql/core";

mesh.resolve("*", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  recordPlanSql(plan, { sql, params });
  return db.query(sql, params);
});
```

See `examples/showcase` for a full demo at `/docs`.

## Integrity

`@meshql/integrity` verifies signed HTTP wire requests. Docs execute is in-process
(no `transport`), so signature checks are skipped; gate access with `auth` instead.
Signed client calls still go through your integrity HTTP adapter as usual.
