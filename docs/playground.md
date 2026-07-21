# Interactive playground (`@meshql/docs`)

Mount a Swagger/GraphQL-Playground-style UI on your MeshQL server with one line.

```ts
import { withDocs } from "@meshql/docs";
import { meshDocsExpressRouter } from "@meshql/docs/express";

const mesh = withDocs(createMesh(schema), {
  path: "/docs",
  title: "My API",
  sql: "dev",   // show SQL + params in the response panel
  auth: false,  // warn in production — use "admin" or a custom guard
});

app.use(meshDocsExpressRouter(mesh, mesh.docs, "/docs"));
```

Open `/docs` for:

- **Entity browser** — fields and joins from `mesh.schema`
- **Click-to-build query** — builds MeshQL selection JSON
- **Live execute** — runs through `mesh.executeDetailed`
- **SQL trace** (dev) — actual SQL + params for SQL adapters

## Routes

| Method | Path | Response |
|---|---|---|
| `GET` | `/docs` | Playground HTML |
| `GET` | `/docs/schema` | `SchemaDoc` JSON |
| `POST` | `/docs/execute` | `{ data, meta: { durationMs, plan?, sql? } }` |

Schema introspection is an **HTTP route**, not a MeshQL `__schema` query.

## Security

- Default-friendly for local eval: `auth: false`
- In production, set `auth: "admin"` or `(ctx) => boolean`
- With `auth: false` and `NODE_ENV=production`, `@meshql/docs` logs a warning
- SQL panel (and raw table/column hints) only when `sql: "dev"`

Pass role context to execute via headers (`X-Mesh-Role`, `X-Mesh-User-Id`) or the execute body `context` field so access plugins see the same user as your API.

When `@meshql/integrity` is enabled, the signed `/mesh` wire still requires tokens. The docs `/docs/execute` path calls `mesh.executeDetailed` **in-process** (no `X-Mesh-*` headers); integrity skips signature checks when there is no HTTP transport. Use `auth` on the docs config to gate who can open the playground.

## SQL trace

Enable `sql: "dev"` and record SQL from resolvers:

```ts
import { recordPlanSql } from "@meshql/core";
import { buildSelectSql } from "@meshql/sqlite";

mesh.resolve("*", async (plan) => {
  const { sql, params } = buildSelectSql(plan, schema);
  recordPlanSql(plan, { sql, params });
  return db.prepare(sql).all(...params);
});
```

ORM adapters may return without SQL; the playground still shows duration and join-plan summary.

## Try it

The [showcase example](https://github.com/meshql/meshql/tree/main/examples/showcase) serves the playground at `http://localhost:3010/docs`.

Package reference: [@meshql/docs](/packages/docs) on the docs site · [README in repo](https://github.com/meshql/meshql/tree/main/packages/docs)
