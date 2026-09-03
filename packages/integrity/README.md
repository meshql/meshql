# @meshql/integrity

Request signing and integrity token lifecycle for MeshQL HTTP servers.

## Install

```bash
npm install @meshqljs/integrity @meshqljs/core @meshqljs/http
# or
npx jsr add @meshql/integrity @meshql/core @meshql/http
```

Published on [npm](https://www.npmjs.com/package/@meshqljs/integrity) as `@meshqljs/integrity` and [JSR](https://jsr.io/@meshql/integrity) as `@meshql/integrity`.

## Example

```ts
import { createMesh } from "@meshql/core";
import { withIntegrity, issueToken } from "@meshql/integrity";

const mesh = withIntegrity(createMesh({ entities: {} }), {
  secret: process.env.MESH_INTEGRITY_SECRET!,
  tokenTTL: "15m",
  authenticate: async () => ({
    userId: "u1",
    sessionId: "s1",
  }),
});

const { token, signingToken } = issueToken(mesh.integrity, {
  userId: "u1",
  sessionId: "s1",
});
```

Wire `token` / request signatures through `@meshql/http` so each query is verified. HMAC covers the exact `X-Mesh-Query` header; a captured signed request can be replayed until `expiresAt` or logout revoke. Use a short `tokenTTL`, TLS, and [persisted queries](https://docs.meshql.dev/packages/persisted-queries) in production. See the [threat model](https://docs.meshql.dev/community/threat-model) and [integrity spec](https://docs.meshql.dev/specs/integrity).

JSR imports: `@meshql/core`, `@meshql/http`, `@meshql/integrity`.
