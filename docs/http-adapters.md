# HTTP adapters

MeshQL ships framework adapters on top of `@meshql/http`. Each adapter wires the same HTTP handler to your server - routes, headers, and error shapes are identical across frameworks.

## Install

MeshQL is on **[JSR](https://jsr.io/@meshql)** (`@meshql` scope) and **[npm](https://www.npmjs.com/package/meshql-http)** (`meshql-*`).

```bash
# Node
npx jsr add @meshql/core @meshql/http

# Bun
bunx jsr add @meshql/core @meshql/http

# Deno
deno add jsr:@meshql/core jsr:@meshql/http
```

Install your framework as a peer dependency:

| Adapter | Import path | Peer dependency |
|---------|-------------|-----------------|
| Express | `@meshql/http/express` | `express` ^4 or ^5 |
| Fastify | `@meshql/http/fastify` | `fastify` ^4 or ^5 |
| Hono | `@meshql/http/hono` | `hono` ^4 |

## Prerequisites

Create a mesh instance and register resolvers before attaching an adapter:

```typescript
import { createMesh } from "@meshql/core";

const mesh = createMesh({
  entities: {
    user: { fields: ["id", "name"], table: "users" },
  },
  joins: {},
});

mesh.resolve("user", async (plan) => {
  // plan.fields - only what the client asked for
  // plan.joins   - only joins the client requested
  return db.query(/* ... */);
});
```

---

## Routes

Base adapter (`meshExpressRouter`, `createMeshFastifyPlugin`, `meshHonoRoutes`) registers:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/mesh/:entity` | List — query via headers |
| `GET` | `/mesh/:entity/:id` | Single resource |
| `POST` | `/mesh` | Complex query in request body |
| `PUT` | `/mesh/:entity/:id` | Point read with PUT transport |
| `POST` | `/mesh/:entity/:id/:field` | Multipart file upload |
| `POST` | `/mesh/:entity` | Multipart upload (create) |

With **`@meshql/integrity`** (`meshIntegrityExpressRouter`), these are added:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/mesh/auth` | Login — returns `signingToken` + `token` |
| `POST` | `/mesh/logout` | Revoke session (`X-Mesh-Token` header) |

Writes use the **same** `/mesh` resource URLs (`PUT` update, `POST`/`DELETE` on
relations). That is not shipped in `@meshql/http` yet (`DELETE` → **405**; today’s
`PUT` is still a temporary point-read transport; `POST .../:field` is file upload).

**Product rule:** REST resource-per-URL for writes — no GraphQL mutation DSL, no
`/mesh/write` RPC. Implement the target paths yourself until core lands.
See [Reads and writes](/guide/reads-and-writes).

Change the base path with the second argument / `options.basePath`.

---

## Query transport (headers)

`GET` and `PUT` carry the query in headers - not the URL.

| Header | Required | Description |
|--------|----------|-------------|
| `X-Mesh-Query` | Yes | Base64-encoded query string |
| `X-Mesh-Format` | No | `json` (default) or `ql` |
| `X-Mesh-Signature` | When integrity enabled | `sha256=` HMAC over `X-Mesh-Query` |
| `X-Mesh-Token` | When integrity enabled | Wire token from `POST /mesh/auth` |

**JSON format** - object selection:

```json
{ "user": { "$select": { "id": true, "name": true } } }
```

**Collection reads** — add controls to the entity read node. They are covered
by the signature when integrity is enabled:

```json
{
  "user": {
    "$select": { "id": true, "name": true },
    "$page": { "first": 20, "after": null },
    "$orderBy": [{ "field": "name", "direction": "asc" }],
    "$where": { "field": "role", "op": "in", "value": ["admin", "owner"] }
  }
}
```

Read controls are **not** passed as URL query strings — they live in the signed
`X-Mesh-Query` body so filters and page size cannot be tampered with separately
from the field selection.

**QL format** - selection-only brace syntax. Use JSON whenever you need
`$where`, `$orderBy`, `$page`, or aggregates:

```
{ user { id name } }
```

Set `X-Mesh-Format: ql` (or `format: "ql"` on POST / `createClient`) explicitly.
JSON is the default on every public surface.

Use `@meshql/client` to encode headers automatically, or `@meshql/http`'s `encodeQuery()`:

```typescript
import { encodeQuery } from "@meshql/http";

const headers = encodeQuery(
  JSON.stringify({ user: { $select: { id: true, name: true } } }),
  "json",
);
// { "X-Mesh-Query": "...", "X-Mesh-Format": "json" }
```

### POST body

`POST /mesh` expects a JSON body. `format` defaults to `json`:

```json
{
  "query": "{\"user\":{\"$select\":{\"id\":true,\"name\":true}}}",
  "format": "json"
}
```

For selection-only QL, pass the brace string and set `"format": "ql"`:

```json
{
  "query": "{ user { id name } }",
  "format": "ql"
}
```

---

## File uploads

Upload routes expect `multipart/form-data` with a `file` part and signed headers
(including `contentHash` in the JSON payload). Use `@meshql/upload` on the server
and `client.upload()` on the client.

```typescript
await client.upload({
  entity: "user",
  field: "avatar",
  id: "1",
  file: blobOrBuffer,
});
```

See [client.md](./client.md) and [examples/express-postgres](../examples/express-postgres).

---

## Integrity auth

```bash
# Login
curl -s -X POST http://localhost:3001/mesh/auth \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@example.com","password":"demo"}'
```

Response:

```json
{
  "signingToken": "...",
  "token": "tok_...",
  "expiresAt": 1783237119316
}
```

Use `createAuthClient` from `@meshql/client` — it handles login and attaches
`X-Mesh-Signature` + `X-Mesh-Token` on subsequent requests.

---

## Test with curl

Base64-encode the query for `GET` requests:

```bash
mesh_query() {
  echo -n "$1" | base64 | tr -d '\n'
}

Q=$(mesh_query '{"user":{"$select":{"id":true,"name":true}}}')

# Single resource
curl -s "http://localhost:3001/mesh/user/1" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json"

# List
curl -s "http://localhost:3001/mesh/user" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json"

# Collection with a keyset page
curl -s "http://localhost:3001/mesh/user" \
  -H "X-Mesh-Query: $(mesh_query '{"user":{"$select":{"id":true,"name":true},"$page":{"first":10},"$orderBy":[{"field":"name","direction":"asc"}]}}')" \
  -H "X-Mesh-Format: json"

# QL format
Q=$(mesh_query '{ user { id name } }')
curl -s "http://localhost:3001/mesh/user/1" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: ql"

# POST (no base64)
curl -s -X POST "http://localhost:3001/mesh" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ user { id name } }","format":"ql"}'

# Missing header (expect 400)
curl -s "http://localhost:3001/mesh/user/1"
```

Full walkthrough: [run-example.md](./run-example.md)

---

## Error responses

Errors return JSON with an appropriate status code:

| Error type | Status | Example |
|------------|--------|---------|
| `TransportError` | 400 | Missing or invalid `X-Mesh-Query` |
| `ValidationError` | 400 | Unknown field in query |
| `ResolverError` | 500 | Your resolver threw |
| `InternalError` | 500 | Unexpected failure |

```json
{
  "error": "ValidationError",
  "message": "Field 'secret' not found on entity 'user'"
}
```

---

## Express

### Router (recommended)

Mounts routes on an Express `Router`:

```typescript
import express from "express";
import { createMesh } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";

const app = express();
app.use(express.json());

const mesh = createMesh(/* schema */);
mesh.resolve("user", async (plan) => { /* ... */ });

app.use(meshExpressRouter(mesh, "/mesh"));

app.listen(3000);
```

### Middleware

Alternative if you prefer a single middleware function:

```typescript
import { meshExpressMiddleware } from "@meshql/http/express";

app.use(meshExpressMiddleware(mesh, "/mesh"));
```

The middleware parses the path after `basePath` into `entity` and `id` segments. Use the router when you want explicit route definitions.

### Example

See [`examples/showcase`](../examples/showcase) for the full React + integrity + access + uploads demo, or [`examples/express-postgres`](../examples/express-postgres) for Postgres + avatar upload.

---

## Fastify

Register the plugin returned by `createMeshFastifyPlugin`:

```typescript
import Fastify from "fastify";
import { createMesh } from "@meshql/core";
import { createMeshFastifyPlugin } from "@meshql/http/fastify";

const mesh = createMesh(/* schema */);
mesh.resolve("user", async (plan) => { /* ... */ });

const fastify = Fastify();

await fastify.register(createMeshFastifyPlugin(mesh, { basePath: "/mesh" }));

await fastify.listen({ port: 3000 });
```

### Options

```typescript
interface MeshFastifyOptions {
  basePath?: string; // default: "/mesh"
}
```

---

## Hono

`meshHonoRoutes` returns a Hono sub-app you can mount on a parent app:

```typescript
import { Hono } from "hono";
import { createMesh } from "@meshql/core";
import { meshHonoRoutes } from "@meshql/http/hono";

const mesh = createMesh(/* schema */);
mesh.resolve("user", async (plan) => { /* ... */ });

const app = new Hono();

// Mount MeshQL routes
const meshRoutes = meshHonoRoutes(mesh, { basePath: "/mesh" });
app.route("/", meshRoutes);

// Or merge into an existing app:
// app.route("/api", meshHonoRoutes(mesh, { basePath: "/mesh" }));

export default app;
```

Works on Node, Bun, and edge runtimes supported by Hono.

### Options

```typescript
interface MeshHonoOptions {
  basePath?: string; // default: "/mesh"
}
```

---

## Framework-agnostic handler

Build a custom integration with `createHttpHandler`:

```typescript
import { createHttpHandler } from "@meshql/http";

const handler = createHttpHandler(mesh);

const result = await handler({
  method: "GET",
  params: { entity: "user", id: "123" },
  headers: req.headers,
});

res.status(result.status).json(result.body);
```

Use this for adapters we don't ship yet (Koa, NestJS, etc.).

---

## Client usage

See **[client.md](./client.md)** for the full SDK guide (browser, React, auth, list, uploads).

```typescript
import { createAuthClient } from "@meshql/client";

const client = createAuthClient({ url: "http://localhost:3000/mesh", format: "json" });
await client.login({ email: "ada@example.com", password: "demo" });

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
  { entityId: "123" },
);

// Collection read with pagination, filters, and ordering
const admins = await client.query(
  {
    user: {
      $select: { id: true, name: true },
      $page: { first: 10 },
      $orderBy: [{ field: "name", direction: "asc" }],
      $where: { field: "role", op: "in", value: ["admin", "owner"] },
    },
  },
);
```

The client sets transport headers on every request. With integrity enabled it also signs the payload.

---

## Related

- [Client SDK](./client.md) — browser, auth, list queries, uploads
- [Run example](./run-example.md) — JSR install, server setup, curl testing
- [README](../README.md) — project overview
- [examples/showcase](../examples/showcase) — React dashboard demo
- [examples/express-postgres](../examples/express-postgres) — Postgres + uploads
