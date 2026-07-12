# meshql-sse

Field-aware MeshQL subscriptions over Server-Sent Events (v0.9.0).

## Install

```bash
npm install meshql-sse meshql-pubsub meshql-core meshql-http
# or
npx jsr add @meshql/sse @meshql/pubsub @meshql/core @meshql/http
```

## Express

```ts
import express from "express";
import { createMesh } from "@meshql/core";
import { meshExpressRouter } from "@meshql/http/express";
import { InMemoryPubSubStore, notifyEntityUpdate } from "@meshql/pubsub";
import { meshSseExpressRouter } from "@meshql/sse/express";

const pubsub = new InMemoryPubSubStore();
const mesh = createMesh(schema);

const app = express();
app.use(meshExpressRouter(mesh, "/mesh"));
app.use(meshSseExpressRouter(mesh, { pubsub }, "/mesh"));

// After a mutation, notify subscribers:
notifyEntityUpdate(pubsub, "post", postId);
```

Clients open `GET /mesh/post/:id/events` with the same `X-Mesh-Query` headers as a point read. Each notification re-runs the selection and streams an `update` SSE event.
