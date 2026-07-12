# meshql-pubsub

Pub/sub backends for MeshQL real-time subscriptions (v0.9.0).

## Install

```bash
npm install meshql-pubsub
# or
npx jsr add @meshql/pubsub
```

## Example (in-memory, dev)

```ts
import {
  InMemoryPubSubStore,
  entityRecordChannel,
} from "@meshql/pubsub";

const pubsub = new InMemoryPubSubStore();

const channel = entityRecordChannel("post", 1);
pubsub.subscribe(channel, (message) => {
  console.log("update", message.payload);
});

pubsub.publish(channel, { type: "updated", id: 1 });
```

Redis and Postgres `LISTEN/NOTIFY` adapters ship in follow-up releases.

See [ROADMAP.md](../../ROADMAP.md) for v0.9.0 (`@meshql/sse` builds on this package).
