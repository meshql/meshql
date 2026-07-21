# @meshql/codemods

## 0.2.1

### Patch Changes

- 9687686: Remove the dead `EntityConfig.type` placeholder from schemas before the 1.0 API freeze.

  Schema definitions, generated schema output, and examples no longer include `type: {}` or `type: {} as T`; delete those placeholders when upgrading. This is a source-level cleanup only and does not add runtime value coercion.

- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
  - @meshql/core@0.8.0

## 0.2.0

### Minor Changes

- 6e9201f: Showcase SSE demo, GraphQL SDL codemods, gateway V1, and Fastify/Hono SSE adapters.
  - **showcase**: live post/comment updates via `@meshql/pubsub` + `@meshql/sse`
  - **@meshql/codemods**: GraphQL SDL → MeshQL schema + migration report CLI
  - **@meshql/gateway**: static multi-service routing and cross-service stitch (V1)
  - **@meshql/sse**: Fastify and Hono adapters
