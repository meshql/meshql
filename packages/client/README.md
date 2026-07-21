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
  {
    post: {
      $select: { id: true, title: true },
      $page: { first: 10 },
      $orderBy: [{ field: "id", direction: "asc" }],
    },
  },
);
```

## Example

```ts
import { createClient } from "meshql-client";

const client = createClient({ url: "http://localhost:3000/mesh" });

const user = await client.query({
  user: {
    $select: {
      id: true,
      email: true,
      tokens: { $select: { accessToken: true } },
    },
  },
});

console.log(user.email);
```

JSON is the default format and supports read controls. For selection-only QL:

```ts
const client = createClient({
  url: "http://localhost:3000/mesh",
  format: "ql",
});

await client.query({
  user: { $select: { id: true, email: true } },
});
```

JSR import: `@meshql/client`.
