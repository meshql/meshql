# @meshql/pubsub

## 0.2.0

### Minor Changes

- 644ea86: Add Redis and Postgres pub/sub adapters, `@meshql/sse` for field-aware SSE subscriptions, and export HTTP handler helpers for SSE refresh.

## 0.1.0

### Minor Changes

- Initial release: `PubSubStore`, `InMemoryPubSubStore`, MeshQL channel helpers.
- Redis adapter (`@meshql/pubsub/redis`) and Postgres LISTEN/NOTIFY adapter (`@meshql/pubsub/postgres`).
- `notifyEntityUpdate()` helper for mutation → subscription fan-out.
