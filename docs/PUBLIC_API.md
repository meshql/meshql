# Public API surface (1.0 freeze)

This is the semver contract for MeshQL heading into **v1.0**. After 1.0, breaking changes to the surfaces below require a **major** bump. Until 1.0 ships, we still treat this document as the freeze target: do not remove or rename these exports without a changeset and a migration note.

**Names:** workspace and JSR packages are `@meshql/<pkg>`. npm publishes as `@meshqljs/<pkg>` (the `@meshql` npm org is not used yet). Import paths in this repo stay `@meshql/*`.

**Public** means a documented `exports` entry in `package.json` / `jsr.json`. Deep imports into `packages/*/src/**` and `dist/chunk-*` are not public.

Mark new, unstable APIs with JSDoc `@experimental` until they are added to this document.

## Freeze tiers

| Tier | Who uses it | Semver |
|------|-------------|--------|
| **Application** | App authors: `createMesh`, HTTP adapters, client, plugins | Frozen. Breaking = major after 1.0 |
| **Adapter** | First-party and third-party SQL/ORM packages | Frozen. Needed by `@meshql/postgres`, `@meshql/sqlite`, `@meshql/prisma`, `@meshql/drizzle`, `@meshql/kysely` |
| **Advanced** | Custom planners, playgrounds, tests | Exported and supported, but not the default app surface. Prefer documented helpers over copying internals |
| **Not public** | Anything else | May change without a major |

We are **not** un-exporting adapter helpers from `@meshql/core`. Dialect packages depend on them. Classifying them is the freeze, not shrinking `index.ts`.

## Package entrypoints

| Package (workspace / JSR) | npm | Public exports | Notes |
|---------------------------|-----|----------------|-------|
| `@meshql/core` | `@meshqljs/core` | `.`, `./builtins` | Engine. See tiers below |
| `@meshql/postgres` | `@meshqljs/postgres` | `.` | `buildSelectSql` |
| `@meshql/sqlite` | `@meshqljs/sqlite` | `.` | `buildSelectSql` |
| `@meshql/http` | `@meshqljs/http` | `.`, `./express`, `./fastify`, `./hono` | Handlers + adapters |
| `@meshql/client` | `@meshqljs/client` | `.` | `createClient`, `createAuthClient`, canonical `MeshQuery`, signing |
| `@meshql/pubsub` | `@meshqljs/pubsub` | `.`, `./redis`, `./postgres` | Stores + notify helpers |
| `@meshql/sse` | `@meshqljs/sse` | `.`, `./express`, `./fastify`, `./hono` | SSE handler + adapters |
| `@meshql/codemods` | `@meshqljs/codemods` | `.` | SDL migration API + CLI bin |
| `@meshql/gateway` | `@meshqljs/gateway` | `.` | `createGateway` V1 |
| `@meshql/docs` | `@meshqljs/docs` | `.`, `./express` | Playground middleware |
| `@meshql/integrity` | `@meshqljs/integrity` | `.`, `./express` | Token lifecycle + router |
| `@meshql/access` | `@meshqljs/access` | `.` | Access plugins |
| `@meshql/access-cache` | `@meshqljs/access-cache` | `.` | Permission cache |
| `@meshql/persisted-queries` | `@meshqljs/persisted-queries` | `.`, `./express` | Query ID registry |
| `@meshql/upload` | `@meshqljs/upload` | `.` | Multipart uploads |
| `@meshql/prisma` | `@meshqljs/prisma` | `.` | ORM resolver + schema inference |
| `@meshql/drizzle` | `@meshqljs/drizzle` | `.` | ORM resolver + schema inference |
| `@meshql/kysely` | `@meshqljs/kysely` | `.` | SQL resolver |

`@meshql/typescript-config` is private and never published.

## `@meshql/core` tiers

### Application

- `createMesh`, `MeshInstance`, `extendSchema`
- Schema types: `MeshConfig`, `MeshSchema`, `EntityConfig`, `ComputedFieldDef`, `JoinConfig`, `ThroughConfig`, `PolymorphicConfig`
- `mesh.execute` / `executeDetailed` / `executeUpload` and related option types
- `parseQuery`, `parseQl`, `parseJsonQuery`, `normalizeReadTree`
- Error classes: `MeshError`, `ParseError`, `ResolverError`, `TransportError`, `ValidationError`, `IntegrityError`, `RateLimitError`
- Plugin types: `MeshPlugin`, `PluginContext`, `ExecuteTransport`, `isPlanShortCircuit`
- Resolver types: `QueryContext`, `Resolver`, `ResolverOptions`, `UploadResolver`, `MeshFile`, `CATCH_ALL`, `createQueryContext`
- Read-control types and constants (`WhereExpr`, `PageInput`, `QUERY_PROTOCOL_VERSION`, `DEFAULT_PAGE_FIRST`, `MAX_PAGE_FIRST`, …)
- HMAC helpers used by the client: `signQueryHeader`, `verifyQuerySignature`, `hmacSha256`, `formatSignature`, `parseSignature`
- `./builtins`: `withBasicIntegrity`, `withRoleAccess`, `logger`, `depthLimit`, `complexityLimit`, `rateLimit`

### Adapter (SQL / ORM / access)

These stay public because dialect and plugin packages import them from `@meshql/core`:

- Plan: `buildJoinPlan`, `JoinPlan`, `ResolvedJoin`, list/cursor helpers
- SQL emit: `emitJoinSql`, `renderWhereSql`, `renderReadWhereSql`, `renderCursorPredicateSql`, `sqlAliasForJoinPath`, `rewriteJoinOn`, and the other `planner/sql-from-plan` helpers
- ORM: `buildPlanRelationTree`, `buildOrmListQuery`, `buildOrmPointRead`, `mapEntityField`
- Access: `stripFieldsFromPlan`, `normalizeFieldPath`, `isFieldDenied`
- Computed: `injectComputedIntoFlatRows`, `applyComputedToPreshaped`
- Shaper: `shape`, `shapeMany`, `shapeAggregateRows`
- Trace: `recordPlanSql`, `createSqlTraceCollector`, `summarizeJoinPlan`
- Schema helpers: `entityTable`, `entityIdField`, `resolveEntityKey`, `validateJoins`, `validateComputedFields`, …

### Advanced (exported, not the default app API)

- `tokenize` — QL lexer (`@internal`)
- `collectAstNodes` — AST walk helper (`@internal`)
- `PluginRunner`, `ResolverRegistry` — used by `createMesh`; construct only if you are building a custom execute path

## Rules for contributors

1. **Additive is fine** (new export, new optional option, new package). Document it here or mark `@experimental`.
2. **Renames, removals, and required new arguments** are breaking. After 1.0 they need a major. Before 1.0 they still need a changeset and a migration snippet.
3. Do not add new `package.json` `exports` subpaths without updating this file.
4. Adapter helpers in `@meshql/core` are public on purpose. If a helper is only for tests, keep it unexported or mark `@internal`.
5. Wire protocol changes belong in `specs/` first, then code.

See also: [threat model](./threat-model.md), [SECURITY.md](../SECURITY.md), [integrity spec](../specs/06-integrity.md).
