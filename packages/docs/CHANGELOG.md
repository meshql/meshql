# @meshql/docs

## 0.2.1

### Patch Changes

- Updated dependencies [674ba44]
  - @meshql/core@0.8.1
  - @meshql/http@0.7.1

## 0.2.0

### Minor Changes

- 9687686: Ship `@meshql/docs` interactive playground (schema introspection, execute proxy, SQL trace) and core `executeDetailed` / plan + SQL trace hooks for 0.10.0.
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

### Patch Changes

- 9687686: Add schema-native computed fields in `@meshql/core`.

  Declare virtual fields with `EntityConfig.computed` (`from` + `compute`). The planner expands physical deps (including cross-entity joins), excludes computed names from SQL, and the execute path applies values on flat and preshaped results. Access denials strip computed fields and only their unrequested deps. Docs introspection lists computed keys with `kind: "computed"`.

- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
- Updated dependencies [9687686]
  - @meshql/core@0.8.0
  - @meshql/http@0.7.0
