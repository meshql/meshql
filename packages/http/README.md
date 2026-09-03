# @meshql/http

HTTP transport and framework adapters for MeshQL.

## Install

```bash
npm install @meshqljs/http @meshqljs/core
# or
npx jsr add @meshql/http @meshql/core
```

Published on [npm](https://www.npmjs.com/package/@meshqljs/http) as `@meshqljs/http` and [JSR](https://jsr.io/@meshql/http) as `@meshql/http`.

## Example

```ts
import { createMesh } from "@meshqljs/core";
import { meshExpressRouter } from "@meshqljs/http/express";
import express from "express";

const mesh = createMesh({ entities: { user: { table: "users" } } });
const app = express();
app.use(meshExpressRouter(mesh, "/mesh"));
app.listen(3000);
```

Other adapters: `@meshqljs/http/fastify`, `@meshqljs/http/hono` (JSR: `@meshql/http/fastify`, `@meshql/http/hono`).
