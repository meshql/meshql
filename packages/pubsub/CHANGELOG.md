# @meshql/pubsub

## 0.2.2

### Patch Changes

- dd3f183: Publish npm packages as `@meshqljs/*`. The `@meshql-js` org is retired. JSR remains `@meshql/*`.

## 0.2.1

### Patch Changes

- f6e96a6: First npm publish under `@meshqljs/*` and a unified `publish.yml` for npm + JSR.

## 0.2.0

### Minor Changes

- 644ea86: Add Redis and Postgres pub/sub adapters, `@meshql/sse` for field-aware SSE subscriptions, and export HTTP handler helpers for SSE refresh.

## 0.1.0

### Minor Changes

- Initial release: `PubSubStore`, `InMemoryPubSubStore`, MeshQL channel helpers.
- Redis adapter (`@meshql/pubsub/redis`) and Postgres LISTEN/NOTIFY adapter (`@meshql/pubsub/postgres`).
- `notifyEntityUpdate()` helper for mutation → subscription fan-out.
