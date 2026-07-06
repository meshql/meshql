# Client SDK

`@meshql/client` is the typed HTTP client for MeshQL APIs. It encodes queries,
sets transport headers, and (with integrity enabled) signs requests.

Works in **Node**, **Bun**, **Deno**, and **modern browsers** — uses `fetch`,
`FormData`, and Web Crypto (no Node `Buffer` or `node:crypto` in the browser bundle).

## Install

```bash
# JSR
npx jsr add @meshql/client

# npm
npm install meshql-client
```

Pair with `@meshql/http` on the server (or use the showcase / integrity router).

---

## Basic usage

```typescript
import { createClient } from "@meshql/client";

const client = createClient({ url: "http://localhost:3000/mesh", format: "json" });

const user = await client.query(
  { user: { id: true, name: true, tokens: { accessToken: true } } },
  { entityId: "1" },
);
```

The client sets `X-Mesh-Query`, `X-Mesh-Format`, and `X-Mesh-Version` on every request.

---

## Auth (integrity mode)

When the server uses `@meshql/integrity`, log in first to obtain signing tokens:

```typescript
import { createAuthClient } from "@meshql/client";

const client = createAuthClient({ url: "/mesh", format: "json" });

const tokens = await client.login({ email: "ada@example.com", password: "demo" });
// tokens: { signingToken, token, expiresAt }

const posts = await client.query(
  { post: { id: true, title: true } },
  { list: { limit: 20, orderBy: [{ field: "createdAt", dir: "desc" }] } },
);
```

Signed requests include:

| Header | Purpose |
|--------|---------|
| `X-Mesh-Query` | Base64-encoded selection (and optional `$list`) |
| `X-Mesh-Signature` | HMAC over `X-Mesh-Query` |
| `X-Mesh-Token` | Wire token from `POST /mesh/auth` |

---

## List queries

Pass `list` in the second argument — serialized as `$list` in the signed JSON payload:

```typescript
const page = await client.query(
  { post: { id: true, title: true, status: true } },
  {
    list: {
      limit: 10,
      orderBy: [{ field: "createdAt", dir: "desc" }],
      filter: [{ field: "status", op: "eq", value: "published" }],
      cursor: "...", // from encodeCursor() on the server
    },
  },
);
```

`list` requires `format: "json"` (the default). Do not combine `list` with `entityId`.

---

## File uploads

When the server registers an upload resolver (`mesh.resolveUpload`) and enables `@meshql/upload`:

```typescript
await client.upload({
  entity: "user",
  field: "avatar",
  id: "1",
  file: document.querySelector("input[type=file]").files[0], // Blob in browser
});
```

The client hashes the file, includes `contentHash` in the signed payload, and POSTs
`multipart/form-data` to `/mesh/:entity/:id/:field`.

---

## Browser + React

See [examples/showcase](../examples/showcase) — a React dashboard that uses
`createAuthClient` in a context provider for login, reads, writes, and uploads.

Pattern:

```tsx
// MeshContext.tsx
const client = createAuthClient({ url: "/mesh", format: "json" });
await client.login({ email, password });

const data = await client.query({ post: { id: true, title: true } }, { list: { limit: 50 } });
```

Build with Vite (or any bundler). The showcase bundles `@meshql/client` directly —
no separate browser build of the client package is required.

---

## Shared secret mode (no auth endpoint)

For simple HMAC signing without the integrity token lifecycle:

```typescript
const client = createClient({
  url: "http://localhost:3000/mesh",
  secret: process.env.MESH_SECRET,
});
```

---

## Related

- [HTTP adapters](./http-adapters.md) — server routes and transport
- [Run example](./run-example.md) — 5-minute setup
- [Showcase app](../examples/showcase/README.md) — full React demo
