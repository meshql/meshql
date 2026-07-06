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
    user: { type: {} as User, fields: ["id", "name"], table: "users" },
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

Core mutations (create/update/delete entities) are not in the base HTTP handler yet —
`DELETE` returns **405** until a mutation story lands in core. The [showcase](../examples/showcase)
uses a preview `POST /mesh/write` route for signed CRUD demos.

Change the base path with the second argument / `options.basePath`.

---

## Query transport (headers)

`GET` and `PUT` carry the query in headers - not the URL.

| Header | Required | Description |
|--------|----------|-------------|
| `X-Mesh-Query` | Yes | Base64-encoded query string |
| `X-Mesh-Format` | No | `json` (default) or `ql` |
| `X-Mesh-Version` | No | Protocol version, defaults to latest (`1`) |
| `X-Mesh-Signature` | When integrity enabled | `sha256=` HMAC over `X-Mesh-Query` |
| `X-Mesh-Token` | When integrity enabled | Wire token from `POST /mesh/auth` |

**JSON format** - object selection:

```json
{ "user": { "id": true, "name": true } }
```

**List reads** — add a `$list` sibling key in the same JSON payload (covered by
the signature when integrity is enabled). Use this for pagination, filtering,
and ordering on `GET /mesh/:entity` (no `:id`):

```json
{
  "user": { "id": true, "name": true },
  "$list": {
    "limit": 20,
    "orderBy": [{ "field": "name", "dir": "asc" }],
    "filter": [{ "field": "role", "op": "in", "value": ["admin", "owner"] }],
    "cursor": "eyJpZCI6MTAwfQ"
  }
}
```

| `$list` key | Type | Notes |
|-------------|------|-------|
| `limit` | integer | Default 50, max 200 |
| `cursor` | string | Opaque keyset cursor from `encodeCursor()` |
| `orderBy` | `{ field, dir }[]` | Multi-key sort; `dir` is `asc` or `desc` |
| `filter` | `{ field, op, value }[]` | Ops: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `like`, `ilike` |

List metadata is **not** passed as URL query strings — it lives in the signed
`X-Mesh-Query` body so filters and page size cannot be tampered with separately
from the field selection.

**QL format** - brace syntax:

```
{ user { id name } }
```

Use `@meshql/client` to encode headers automatically, or `@meshql/http`'s `encodeQuery()`:

```typescript
import { encodeQuery } from "@meshql/http";

const headers = encodeQuery(
  JSON.stringify({ user: { id: true, name: true } }),
  "json",
);
// { "X-Mesh-Query": "...", "X-Mesh-Format": "json", "X-Mesh-Version": "1" }
```

### POST body

`POST /mesh` expects a JSON body:

```json
{
  "query": "{ user { id name } }",
  "format": "ql"
}
```

`format` is optional (defaults to `ql`).

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

Q=$(mesh_query '{"user":{"id":true,"name":true}}')

# Single resource
curl -s "http://localhost:3001/mesh/user/1" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json"

# List
curl -s "http://localhost:3001/mesh/user" \
  -H "X-Mesh-Query: $Q" \
  -H "X-Mesh-Format: json"

# List
curl -s "http://localhost:3001/mesh/user" \
  -H "X-Mesh-Query: $(mesh_query '{"user":{"id":true,"name":true},"$list":{"limit":10,"orderBy":[{"field":"name","dir":"asc"}]}}')" \
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
      id: true,
      name: true,
      tokens: { accessToken: true },
    },
  },
  { entityId: "123" },
);

// List read with pagination, filters, and ordering ($list in signed payload)
const admins = await client.query(
  { user: { id: true, name: true } },
  {
    list: {
      limit: 10,
      orderBy: [{ field: "name", dir: "asc" }],
      filter: [{ field: "role", op: "in", value: ["admin", "owner"] }],
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
