# @meshql/client

Typed client SDK for MeshQL APIs.

## Install

```bash
npm install meshql-client
# or
npx jsr add @meshql/client
```

Published on [npm](https://www.npmjs.com/package/meshql-client) as `meshql-client` and [JSR](https://jsr.io/@meshql/client) as `@meshql/client`.

## Browser

The client runs in modern browsers — it uses `fetch`, `FormData`, `Blob`, and
Web Crypto for signing and uploads. No Node `Buffer` or `node:crypto` required.

```ts
import { createAuthClient } from "meshql-client";

const client = createAuthClient({ url: "/mesh", format: "json" });
await client.login({ email: "ada@example.com", password: "demo" });

const posts = await client.query(
  { post: { id: true, title: true } },
  { list: { limit: 10 } },
);
```

## Example

```ts
import { createClient } from "meshql-client";

const client = createClient({ url: "http://localhost:3000/mesh" });

const user = await client.query({
  user: { id: true, email: true, tokens: { accessToken: true } },
});

console.log(user.email);
```

JSR import: `@meshql/client`.
