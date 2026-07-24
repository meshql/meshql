# @meshql/gateway

## 0.2.4

### Patch Changes

- Updated dependencies [f2511aa]
  - @meshql/core@0.10.0
  - @meshql/client@0.8.1

## 0.2.3

### Patch Changes

- d90a8df: Make JSON the default query format everywhere and harden selection-only QL.
  `mesh.execute()` and `POST /mesh` now default to `json` (matching GET headers
  and `@meshql/client`). Pass `{ format: "ql" }` or `"format": "ql"` explicitly
  for brace syntax. The QL parser now rejects unsupported characters, trailing
  content, missing outer braces, and empty selections.
- Updated dependencies [d90a8df]
- Updated dependencies [d90a8df]
  - @meshql/client@0.8.0
  - @meshql/core@0.9.0

## 0.2.2

### Patch Changes

- Updated dependencies [674ba44]
  - @meshql/core@0.8.1
  - @meshql/client@0.7.1

## 0.2.1

### Patch Changes

- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
  - @meshql/core@0.8.0
  - @meshql/client@0.7.0

## 0.2.0

### Minor Changes

- 6e9201f: Showcase SSE demo, GraphQL SDL codemods, gateway V1, and Fastify/Hono SSE adapters.
  - **showcase**: live post/comment updates via `@meshql/pubsub` + `@meshql/sse`
  - **@meshql/codemods**: GraphQL SDL → MeshQL schema + migration report CLI
  - **@meshql/gateway**: static multi-service routing and cross-service stitch (V1)
  - **@meshql/sse**: Fastify and Hono adapters
