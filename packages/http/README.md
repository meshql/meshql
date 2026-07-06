# @meshql/http

HTTP transport and framework adapters for MeshQL.

## Install

```bash
npm install meshql-http meshql-core
# or
npx jsr add @meshql/http @meshql/core
```

Published on [npm](https://www.npmjs.com/package/meshql-http) as `meshql-http` and [JSR](https://jsr.io/@meshql/http) as `@meshql/http`.

## Example

```ts
import { createMesh } from "meshql-core";
import { meshExpressRouter } from "meshql-http/express";
import express from "express";

const mesh = createMesh({ entities: { user: { table: "users" } } });
const app = express();
app.use(meshExpressRouter(mesh, "/mesh"));
app.listen(3000);
```

Other adapters: `meshql-http/fastify`, `meshql-http/hono` (JSR: `@meshql/http/fastify`, `@meshql/http/hono`).
