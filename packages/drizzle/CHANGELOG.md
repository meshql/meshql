# @meshql/drizzle

## 0.7.5

### Patch Changes

- Updated dependencies [1bd0c4a]
  - @meshql/core@0.10.0

## 0.7.4

### Patch Changes

- Updated dependencies [d90a8df]
- Updated dependencies [d90a8df]
  - @meshql/core@0.9.0

## 0.7.3

### Patch Changes

- Updated dependencies [674ba44]
  - @meshql/core@0.8.1

## 0.7.2

### Patch Changes

- 9687686: Replace legacy `$list` collection queries with JSON read controls as the single query protocol.

  **Breaking changes (0.x minor):**
  - Remove `$list`, `X-Mesh-Version`, and `protocolVersion` negotiation.
  - Collection queries use `$select`, `$where`, `$orderBy`, `$page`, `$groupBy`, `$aggregate`, `$having`, and `$distinct`.
  - List responses use `{ data: { items, pageInfo }, meta }`; point reads use `{ data: object | null, meta }`.
  - Rename public APIs: `parseQueryV2` → `parseJsonQuery`, `CursorPayloadV2` → `ReadCursorPayload`, `encodeCursorV2`/`decodeCursorV2` → `encodeReadCursor`/`decodeReadCursor`, `QueryV2Document` → `QueryDocument`, `ExecuteResultV2` → `ExecuteResult`.
  - Client SDK: replace `list` options with read controls (`page`, `orderBy`, `where`, etc.).

  **Migration:**
  - Replace `$list: { limit, cursor, orderBy, where }` with `$page: { first, after }`, `$orderBy`, and `$where` on the same node.
  - Update client code from `client.query({ ..., list: { ... } })` to read-control fields.
  - Update response handling from flat arrays / v1 envelopes to `data.items` + `data.pageInfo`.
  - See `specs/05-read-controls.md` for the active protocol contract.

- 9687686: Remove the dead `EntityConfig.type` placeholder from schemas before the 1.0 API freeze.

  Schema definitions, generated schema output, and examples no longer include `type: {}` or `type: {} as T`; delete those placeholders when upgrading. This is a source-level cleanup only and does not add runtime value coercion.

- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
  - @meshql/core@0.8.0

## 0.7.1

### Patch Changes

- Updated dependencies
  - @meshql/core@0.7.1

## 0.7.0

### Minor Changes

- v0.7.0: schema inference from ORMs — `extendSchema` in core, `schemaFromPrisma` / `schemaFromPrismaSource`, and `schemaFromDrizzle`. Express-prisma demo now infers its MeshSchema from `schema.prisma`.

### Patch Changes

- Updated dependencies
  - @meshql/core@0.7.0

## 0.6.0

### Minor Changes

- v0.6.0: ORM adapters (Prisma, Drizzle, Kysely) and core support for preshaped resolvers, ORM plan-relation helpers, and cursor exports. Includes `examples/express-prisma` and ORM documentation.

### Patch Changes

- Updated dependencies
  - @meshql/core@0.6.0

## 0.6.0

### Minor Changes

- Initial release: `drizzleResolver`, `withDrizzle`, and Drizzle relational `with` query builders from JoinPlan.
