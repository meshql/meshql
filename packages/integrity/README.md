# @meshql/integrity

Request signing and integrity token lifecycle for MeshQL HTTP servers.

## Install

```bash
npm install meshql-integrity meshql-core meshql-http
# or
npx jsr add @meshql/integrity @meshql/core @meshql/http
```

Published on [npm](https://www.npmjs.com/package/meshql-integrity) as `meshql-integrity` and [JSR](https://jsr.io/@meshql/integrity) as `@meshql/integrity`.

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

Wire `token` / request signatures through `@meshql/http` so each query is verified. See the [security docs](https://docs.meshql.dev) for the full auth flow.

JSR imports: `@meshql/core`, `@meshql/http`, `@meshql/integrity`.
