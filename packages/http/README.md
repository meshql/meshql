# @meshql/http

HTTP transport and framework adapters for MeshQL.

## Example

```ts
import { createMesh } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import express from "express";

const mesh = createMesh({ entities: { user: { table: "users" } } });
const app = express();
app.use(meshExpressRouter(mesh, "/mesh"));
app.listen(3000);
```

Other adapters: `@meshql/http/fastify`, `@meshql/http/hono`.
