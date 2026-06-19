# @meshql/client

Typed client SDK for MeshQL APIs.

## Install

```bash
npx jsr add @meshql/client
```

Published on [JSR](https://jsr.io/@meshql/client). npm coming soon.

## Example

```ts
import { createClient } from "@meshql/client";

const client = createClient({ url: "http://localhost:3000/mesh" });

const user = await client.query({
  user: { id: true, email: true, tokens: { accessToken: true } },
});

console.log(user.email);
```
