# @meshql/client

Typed client SDK for MeshQL APIs.

## Example

```ts
import { createClient } from "@meshql/client";

const client = createClient({ url: "http://localhost:3000/mesh" });

const user = await client.query({
  user: { id: true, email: true, tokens: { accessToken: true } },
});

console.log(user.email);
```
