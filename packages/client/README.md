# @meshql/client

Typed client SDK for MeshQL APIs.

## Install

```bash
npx jsr add @meshql/client
# or
npm install meshql-client
```

Published on [JSR](https://jsr.io/@meshql/client). Also on [npm](https://www.npmjs.com/package/meshql-client) as `meshql-client`.

## Browser

The client runs in modern browsers — it uses `fetch`, `FormData`, `Blob`, and
Web Crypto for signing and uploads. No Node `Buffer` or `node:crypto` required.

```ts
import { createAuthClient } from "@meshql/client";

const client = createAuthClient({ url: "/mesh", format: "json" });
await client.login({ email: "ada@example.com", password: "demo" });

const posts = await client.query(
  { post: { id: true, title: true } },
  { list: { limit: 10 } },
);
```

See [examples/showcase](../../examples/showcase) for a full React dashboard using `@meshql/client`.

## Example

```ts
import { createClient } from "@meshql/client";

const client = createClient({ url: "http://localhost:3000/mesh" });

const user = await client.query({
  user: { id: true, email: true, tokens: { accessToken: true } },
});

console.log(user.email);
```
