# meshql-pubsub

Pub/sub backends for MeshQL real-time subscriptions (v0.9.0).

## Install

```bash
npm install meshql-pubsub
# or
npx jsr add @meshql/pubsub
```

## Backends

| Backend | Import | Use case |
|---------|--------|----------|
| In-memory | `@meshql/pubsub` | Dev, single-node |
| Redis | `@meshql/pubsub/redis` | Production, multi-node |
| Postgres | `@meshql/pubsub/postgres` | Zero extra infra (`LISTEN/NOTIFY`) |

## Example (in-memory)

```ts
import {
  InMemoryPubSubStore,
  entityRecordChannel,
  notifyEntityUpdate,
} from "@meshql/pubsub";

const pubsub = new InMemoryPubSubStore();

pubsub.subscribe(entityRecordChannel("post", 1), (message) => {
  console.log("update", message.payload);
});

notifyEntityUpdate(pubsub, "post", 1);
```

## Redis

```ts
import { createRedisPubSubStore } from "@meshql/pubsub/redis";

const pubsub = createRedisPubSubStore({
  url: process.env.REDIS_URL!,
});
```

## Postgres

```ts
import { Pool } from "pg";
import { createPostgresPubSubStore } from "@meshql/pubsub/postgres";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const pubsub = createPostgresPubSubStore({ pool });
```

Pairs with [`@meshql/sse`](../sse) for browser subscriptions.
