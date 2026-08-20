# @meshql/http

HTTP transport and framework adapters for MeshQL.

## Install

```bash
npm install @meshql-js/http @meshql-js/core
# or
npx jsr add @meshql/http @meshql/core
```

Published on [npm](https://www.npmjs.com/package/@meshql-js/http) as `@meshql-js/http` and [JSR](https://jsr.io/@meshql/http) as `@meshql/http`.

## Example

```ts
import { createMesh } from "@meshql-js/core";
import { meshExpressRouter } from "@meshql-js/http/express";
import express from "express";

const mesh = createMesh({ entities: { user: { table: "users" } } });
const app = express();
app.use(meshExpressRouter(mesh, "/mesh"));
app.listen(3000);
```

Other adapters: `@meshql-js/http/fastify`, `@meshql-js/http/hono` (JSR: `@meshql/http/fastify`, `@meshql/http/hono`).
