# @meshqljs/sse / @meshql/sse

Field-aware MeshQL subscriptions over Server-Sent Events (v0.9.0).

## Install

```bash
npm install @meshqljs/sse @meshqljs/pubsub @meshqljs/core @meshqljs/http
# or
npx jsr add @meshql/sse @meshql/pubsub @meshql/core @meshql/http
```

## Express

```ts
import { meshSseExpressRouter } from "@meshql/sse/express";
app.use(meshSseExpressRouter(mesh, { pubsub }, "/mesh"));
```

## Fastify / Hono

```ts
import { createMeshSseFastifyPlugin } from "@meshql/sse/fastify";
import { meshSseHonoRoutes } from "@meshql/sse/hono";
```

Signed requests (integrity/access plugins) use the same headers as GET — access control runs on each SSE refresh via `handleGet`.
