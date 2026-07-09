# MeshQL Roadmap — from 0.1.x to ORM integration

> A phased plan to take MeshQL from "v0.1 prototype with a Postgres SQL helper"
> to "drop-in REST middleware with field selection, integrity, native uploads,
> and ORM-driven schemas." Optimised for a single maintainer working
> ~8–10 hours/week.

---

## Vision

A developer should be able to wire MeshQL into an Express app in ten lines and
get a field-selecting REST API backed by their existing ORM, with cryptographic
request integrity and native multipart uploads:

```ts
import express from "express";
import { createMesh } from "meshql-core";
import { meshExpressRouter } from "meshql-http/express";
import { withIntegrity } from "meshql-integrity";
import { withUpload } from "meshql-upload";
import { prismaResolver, schemaFromPrisma } from "meshql-prisma";
import { prisma } from "./db.js";

const schema = await schemaFromPrisma("./prisma/schema.prisma");
const mesh = createMesh(schema);
withIntegrity(mesh, { secret: process.env.SECRET, authenticate });
withUpload(mesh, { storage: "s3", bucket: "uploads" });
mesh.resolve("*", prismaResolver(prisma));

express()
  .use(express.json())
  .use(meshExpressRouter(mesh, "/api"))
  .listen(3000);
```

Every gap between this snippet and what the repo does today is a roadmap item.

## Status (as of 0.7.1)

**Current sequence** — Phase 1 landed first (correctness took precedence over
repositioning), then the chosen execution order is:

| Step | What | Status |
|---|---|---|
| A | Cut **0.2.0** with the Phase 1 correctness fixes | ✅ |
| B | CI Postgres integration test (was item 1.10) | ✅ |
| C | **Phase 0** — split `@meshql/postgres` + `@meshql/sqlite` out of `@meshql/core` | ✅ (shipped in 0.2.0) |
| D | **Phase 2** — `JoinPlan.list`, filters, cursors, catch-all resolver | ✅ |
| E | Decide on **Phase 4.5** wire protocol work (persisted queries / compression / CBOR) — placement and timing | ✅ scoped to **0.8.0** (persisted queries; CBOR deferred) |
| F | **Phase 3** — native multipart uploads with signed body | ✅ (0.5.0) |
| G | Showcase blog app (`examples/showcase`) | ✅ |
| H | Multi-level nested fields | ✅ (0.5.1) |
| I | **Phase 4** — ORM adapters (Prisma, Drizzle, Kysely) | ✅ (0.6.0) |
| J | **Phase 5** — `schemaFromPrisma` / `schemaFromDrizzle` / `extendSchema` | ✅ (0.7.0) |
| K | **Slice B** — shaper `shapeRefMany` O(N²)→O(N) + `makeFieldReader` hot-loop caching | ✅ (0.7.1) |
| L | Language-agnostic **protocol specs** + conformance fixtures (`specs/`, docs.meshql.dev/specs) | ✅ |
| M | **FAQ** on docs site + list `$list` field validation (no cross-entity filter/orderBy) | ✅ (0.7.1) |

Phases 3 → 5 follow the original order. The headline plan below describes
the *intended* phase progression; the Status table is the source of truth for
*actual* sequencing through 0.x.

### This week (ship before v0.8.0 work)

Focus shifts from polish to expand — docs and protocol specs are done. These are
quick wins with outsized impact:

| Priority | Item | Why now | Effort |
|---|---|---|---|
| **P0** | **Docs SEO** — add `meta name="description"` to docs.meshql.dev | Other mesh projects drown out MeshQL in Google; fix discoverability | ✅ done |
| **P1** | **Fix stale SQLite README** — `express-postgres` still says "SQLite is not supported" | Embarrassing if someone finds it; `@meshql/sqlite` is first-class | ✅ done |
| **P2** | **Fix release CI** — tag push must trigger `publish-jsr` / `publish-npm` | Blocks every release until fixed | ✅ done |
| **P3** | **Schema naming polish** — `console.warn` at `createMesh()` for irregular plurals without `table:` | Cheap footgun fix before 0.8 | ✅ done |

### v0.8.0 — Performance & production wire protocol

Must ship. Biggest perf and trust gaps for production adopters.

| Priority | Item | Notes | Effort |
|---|---|---|---|
| **P0** | **`@meshql/persisted-queries`** | Register query → get ID; `X-Mesh-Query-Id: q_a3f1` (10 bytes vs ~300); biggest production perf win; solves large-query header limits | ✅ shipped (0.8.0) |
| **P1** | **`@meshql/access-cache`** | Redis / Upstash / in-memory; cache permission results per user; 60s default TTL; manual invalidation API | 1 week |
| **P1** | **Core test coverage** | Parser, planner, shaper — the trust gap right now | 1–2 weeks |
| **P2** | **`examples/express-drizzle`** | Parity with express-prisma, inferred schema | 2–3 evenings |
| **P3** | **More demos** — `fastify-drizzle`, `hono-kysely` (edge/SQLite) | Stretch if time allows | 1 week |

Deferred from old Phase 4.5 plan: compression / optional CBOR — revisit after
persisted queries land.

### v0.9.0 — Real-time & federation

| Priority | Item | Notes | Effort |
|---|---|---|---|
| **P0** | **`@meshql/sse`** | Field-aware SSE subscriptions; same field selection as queries; access control applies automatically | 1–2 weeks |
| **P0** | **`@meshql/pubsub`** | Memory (dev), Redis (prod), Postgres LISTEN/NOTIFY (zero extra infra) | 1 week |
| **P1** | **`@meshql/gateway` V1** | Federated multi-service queries; replace GraphQL subgraphs; static service config first; parallel fetch + stitch | 2–3 weeks |
| **P1** | **`@meshql/codemods`** | GraphQL SDL → MeshQL schema; biggest migration unlock | 1–2 weeks |
| **P2** | **API audit** | Mark internals, freeze public surface heading into 1.0 | 1 week |
| **P2** | **Security pass** | Replay nonces/timestamps, threat-model doc (complements v1.0 integrity audit) | 1 week |

### v1.0.0 — Stability contract

Non-negotiables for the 1.0 cut:

| Item | Notes |
|---|---|
| **Zero breaking changes** from 0.9 → 1.0 | Semver freeze starts here |
| **`@meshql` npm org resolved** | Migrate `meshql-*` → `@meshql/*` cleanly |
| **Security audit of `@meshql/integrity`** | External or structured self-audit with published findings |
| **Performance benchmarks published** | vs GraphQL + dataloaders — numbers, not claims (`measure-shaper.mjs` is the seed) |
| **Auth adapters** | `@meshql/auth-clerk`, `@meshql/auth-auth0`, `@meshql/auth-jwt` |
| **Go port planning started** | Spec already published ✅; find Go maintainer; placeholder repo |

## Goals (v1.0 scope)

- Database-agnostic via the resolver pattern + first-party ORM adapters
- REST-native: URLs, methods, multipart bodies — no GraphQL ceremony
- Cryptographic request integrity (one-way keys, expiring tokens, signed bodies)
- Drop-in Express middleware; Fastify and Hono ports kept in lockstep
- Schema can be hand-written or inferred from an ORM
- Real list endpoints: pagination, filtering, ordering, cursors
- Native file upload signed end-to-end

## Non-goals (v1.0)

- WebSocket subscriptions (SSE ships in 0.9; full duplex deferred)
- Owning a SQL builder for every database — the resolver layer is the abstraction
- Custom mutation verbs beyond entity CRUD — defer to a plugin in v1.x
- A query IDE / GraphiQL clone
- Browser-side schema editor

## Phase summary

```mermaid
gantt
    title MeshQL phases to ORM integration
    dateFormat  YYYY-MM-DD
    axisFormat  W%V
    section Repositioning
    Phase 0 Repositioning            :p0, 2026-01-05, 2d
    section Correctness
    Phase 1 Correctness foundation   :p1, after p0, 14d
    section Features
    Phase 2 Plan ext and catch-all   :p2, after p1, 10d
    Phase 3 Native uploads           :p3, after p2, 12d
    Phase 4 ORM adapters             :p4, after p3, 14d
    Phase 5 Schema inference         :p5, after p4, 7d
```

| Phase | Outcome | Release | Effort (calendar) | Status |
|---|---|---|---|---|
| 0 | Reposition: `@meshql/postgres` + `@meshql/sqlite` split out of core | `0.3.0` | 1 evening | ✅ done |
| 1 | Correctness bugs fixed, Postgres integration test passes | `0.2.0` | 2 weeks | ✅ done |
| 2 | List queries, filters, cursors, catch-all resolver | `0.4.0` | 1.5 weeks | ✅ done |
| 3 | Multipart upload with signed body | `0.5.0` | ~2 weeks | ✅ done |
| 4 | Prisma + Drizzle + Kysely adapters | `0.6.0` | 2 weeks | ✅ done |
| 4.5 | Wire protocol: persisted queries, access cache | `0.8.0` | ~2 weeks | 🔄 planned |
| 5 | `schemaFromPrisma` / `schemaFromDrizzle` / `extendSchema` | `0.7.0` | 1 week | ✅ done |
| 5b | Shaper perf: O(N) `shapeRefMany`, cached field readers | `0.7.1` | 2 evenings | ✅ done |
| _post_ | Perf wire protocol, real-time, federation, v1.0 cut | `0.8 → 1.0` | 8–12 weeks | 🔄 in progress |

Use Changesets (already configured) for every phase. Bump majors freely until 1.0.

---

## Phase 0 — Repositioning (1 evening) ✅ DONE

> Stop describing MeshQL as a SQL-building library. The Postgres helper becomes
> one of many adapters. This is a *messaging* change with a small code move.
>
> **Note**: Originally scheduled first; Phase 1 ran ahead because the
> correctness bugs were blocking real-world use. Phase 0 then expanded to
> ship **two** first-class adapters simultaneously — see "Why two adapters"
> below.
>
> **What landed in 0.3.0**:
>
> - `@meshql/postgres` (new): `buildSelectSql` with `$1, $2, …` placeholders
>   plus the Postgres integration test moved here from `@meshql/core`.
> - `@meshql/sqlite` (new): `buildSelectSql` with `?` placeholders, designed
>   for Node 22.5+'s built-in `node:sqlite`. End-to-end tests against
>   `:memory:` run in the fast `pnpm test` suite — no Docker required.
> - `@meshql/core` no longer exports SQL helpers. Breaking change documented
>   in `.changeset/phase-0-repositioning.md` with a migration snippet.
> - `examples/express-postgres` switched import to `@meshql/postgres`.
> - `examples/express-sqlite` (new): drop-in companion example that boots in
>   ~3s with zero infrastructure.
>
> **Why two adapters now (not just one)**: with only Postgres in the
> picture, "DB-agnostic" is unverified marketing. Shipping two first-party
> adapters with identical APIs but divergent placeholder strategies forces
> the abstraction to be real on day one. Cost: ~30 LOC of duplication in
> the builder. Benefit: SQLite users can run MeshQL in 5 seconds with zero
> setup, and Phase 4 (ORMs) inherits a proven contract.

### Tasks

1. Create `packages/postgres/` with the same layout as other packages
   (`src/`, `tsup.config.ts`, `tsconfig.json`, `package.json`, `jsr.json`,
   `CHANGELOG.md`). Publishes as `meshql-postgres` / `@meshql/postgres`.
2. Move `packages/core/src/sql/*` → `packages/postgres/src/`.
3. Drop the `buildSelectSql` re-exports from `packages/core/src/index.ts`.
4. Update `examples/express-postgres/src/server.ts` to import from
   `@meshql/postgres`.
5. **(Expanded)** Create `packages/sqlite/` mirroring the Postgres layout.
   Builder emits `?` placeholders. Targets Node 22.5+'s `node:sqlite`.
6. **(Expanded)** Create `examples/express-sqlite/` — drop-in example that
   needs no infrastructure (uses `:memory:`).
7. Rewrite the README:
   - New tagline: *"DB-agnostic REST middleware with field selection,
     integrity, and uploads — drop it into Express."*
   - Hero code block: the 10-line snippet from the Vision section (mark
     `prismaResolver` and `schemaFromPrisma` as *coming in 0.6/0.7*).
   - Move the SQL-builder example to a "Helpers — Postgres / SQLite"
     section near the bottom, after the Express drop-in.
8. Add a changeset documenting the breaking move for anyone importing
   `buildSelectSql` from `@meshql/core`.

### Acceptance

- `pnpm build && pnpm test` both clean.
- README's first runnable code block is the resolver-first drop-in.
- `pnpm publish:npm:pack` produces `meshql-postgres-0.2.0-*.tgz`.

### Notes

This is intentionally cheap. Doing it first prevents every subsequent task from
being framed against the wrong mental model.

---

## Phase 1 — Correctness foundation (2 weeks) ✅ DONE

> Make the engine correct on the cases the existing tests don't cover. Without
> this nothing else matters.
>
> **All items below are landed in 0.2.0.** See
> `.changeset/phase-1-correctness.md` for the release notes.

### 1.1 Schema gets `idField` ✅

`packages/core/src/schema/schema.ts`:

```ts
export interface EntityConfig {
  type: unknown;
  fields: string[];
  idField?: string;       // default "id"
  table?: string;
  columns?: Record<string, string>;
}
```

`idField` is the authoritative way to identify a row for shaping, deduping, and
cursor pagination. The shaper uses it instead of guessing.

### 1.2 Fix the shaper Cartesian-product bug ✅

Today, a query with two `many` joins produces `count(a) × count(b)` flat rows
and the shaper duplicates each nested record. Rewrite
`packages/core/src/shaper/shaper.ts`:

- For each `many` ref, group the rows by that ref's `idField` and emit one
  nested record per unique id.
- For each `one` ref, take the first non-null match.
- If every row's ref columns are null (left join with no match), emit `[]` for
  `many` and `null` for `one`.

### 1.3 Fix `shapeMany` root grouping ✅

Stop falling back to `node.fields[0]` when `id` isn't requested. Use the
schema's `idField`. Project the id column internally even if the client didn't
request it, and strip it from the output before returning.

### 1.4 Remove `handleDelete` (or wire it up) ✅

`packages/http/src/handlers/index.ts:68` currently returns a hardcoded
`{ deleted: true, … }` without calling any resolver. Either:

- **Drop the DELETE route** for v0.2 (recommended — no real mutation story yet).
- Or add `mesh.delete(entity, resolver)` to the registry and route DELETE
  requests through it.

Prefer dropping it. Add it back in a later phase along with PATCH/POST
mutations as part of the CRUD story.

### 1.5 Quote SQL aliases in `@meshql/postgres` ✅

`AS "tokens_accessToken"` instead of `AS tokens_accessToken`. Added in
`@meshql/core` (the SQL builder hasn't moved out yet — see Phase 0).
Regression guard lives in
`packages/core/src/sql/builder.integration.test.ts`.

### 1.6 Plugin runner cleanup ✅

`packages/core/src/plugin/runner.ts`:

- Remove the dead `isPlanShortCircuit(result) ? plan : result` branch
  inside `runOnPlan` — once a short-circuit fires the loop returns.
- Add a comment documenting the onion ordering
  (`onRequest`/`onPlan` forward, `onResult`/`onResponse` reverse).

### 1.7 Rate-limit cleanup ✅

`packages/core/src/builtins/plugins/rate-limit.ts`:

- Remove the unused module-level `stores` map.
- Decide explicitly whether multiple `rateLimit()` instances share state
  (probably not — keep per-instance).
- Document the choice in a JSDoc comment.

### 1.8 Real `RateLimitError` class ✅

`packages/core/src/errors/index.ts`:

```ts
export class RateLimitError extends MeshError {
  constructor(message: string, public readonly retryAfterMs?: number) {
    super(message, "RateLimitError", retryAfterMs ? { retryAfterMs } : undefined);
  }
}
```

Update `packages/http/src/index.ts` to map by `instanceof RateLimitError`,
not by string-matching `error.code === "RateLimitError"`. Same audit for the
other error codes.

### 1.9 Tests to add ✅

`packages/core/src/shaper/shaper.test.ts` — five new cases:

- Two `many` joins on the same root: `2 tokens × 2 roles = 4 input rows →
  2 tokens + 2 roles` in output.
- Left join with no match: emits `[]` for `many`, `null` for `one`.
- `shapeMany` with mixed-cardinality joins across multiple root records.
- Root entity without an `idField` declared falls back to `"id"`.
- Schema declares `idField: "uuid"` — shaper uses it.

`packages/core/src/sql/builder.test.ts` → moved to `packages/postgres/`:

- Aliases are quoted.
- Mixed-case columns round-trip through real Postgres (integration test).
- Composite `WHERE` with multiple `entityId` lookups.

### 1.10 CI integration test matrix ✅

`.github/workflows/ci.yml` now has two jobs:

- `build-and-test` — existing fast unit suite + typecheck + build (excludes
  `*.integration.test.ts` via `pnpm test`'s vitest filter).
- `integration` — spins up a Postgres 16 service container and runs
  `pnpm test:integration`, which currently exercises
  `packages/core/src/sql/builder.integration.test.ts`.

The integration test will move to `packages/postgres/` during Phase 0; the
workflow stays the same since `test:integration` is a top-level turbo task.

Local usage:

```bash
docker run -d --rm --name meshql-pg -p 5432:5432 \
  -e POSTGRES_USER=meshql -e POSTGRES_PASSWORD=meshql \
  -e POSTGRES_DB=meshql_test postgres:16
DATABASE_URL=postgres://meshql:meshql@localhost:5432/meshql_test \
  pnpm test:integration
```

### Acceptance

- All five new shaper test cases pass.
- Postgres integration test passes in CI.
- `pnpm test` finishes in <10s; integration tests in <60s.
- Changeset entries for each fix.

**Release: 0.2.0** (breaking: `idField` schema addition is non-breaking with a
default; SQL builder move is breaking. Document both in the changeset.)

---

## Phase 2 — JoinPlan extensions + catch-all resolver (1.5 weeks) ✅ DONE

> Make list endpoints real. Plumb pagination, filtering, ordering down to the
> resolver. Add the catch-all resolver pattern that ORM adapters will rely on.
>
> **What landed in 0.4.0**:
>
> - `JoinPlan.list` with `ListOptions` (limit, cursor, orderBy, filter).
> - List metadata travels in the signed JSON wire payload as `$list` — not URL
>   query strings — so pagination and filters stay inside the integrity boundary.
> - Catch-all resolver via `mesh.resolve("*", fn)`; specific resolvers win.
> - `@meshql/postgres` and `@meshql/sqlite` builders generate parameterized
>   `WHERE`/`ORDER BY`/`LIMIT` and keyset cursor predicates; `encodeCursor` /
>   `decodeCursor` helpers exported from both adapters.
> - `@meshql/client` accepts a `list` option that serializes `$list` into the
>   signed `X-Mesh-Query` header automatically.

### 2.1 Extend `JoinPlan` with `list`

`packages/core/src/planner/join-plan.ts`:

```ts
export interface JoinPlan {
  rootEntity: string;
  fields: string[];
  joins: ResolvedJoin[];
  context: QueryContext;
  list?: ListOptions;
}

export interface ListOptions {
  limit?: number;          // default 50, max 200
  cursor?: string;         // opaque base64 cursor
  orderBy?: OrderBy[];     // multi-key
  filter?: Filter[];
}

export interface OrderBy {
  field: string;
  dir: "asc" | "desc";
}

export type FilterOp =
  | "eq" | "ne" | "gt" | "gte" | "lt" | "lte"
  | "in" | "nin" | "like" | "ilike";

export interface Filter {
  field: string;
  op: FilterOp;
  value: unknown;
}
```

`list` is set when the wire payload includes `$list`, when the caller passes
`listOptions` to `mesh.execute()`, or when the HTTP route is a list read (no
`:id` segment) and list metadata is present in the signed query.

### 2.2 List metadata in the signed wire payload ✅

MeshQL carries queries in `X-Mesh-Query` (base64 JSON), not URL query strings.
List options are a `$list` sibling key in that JSON so they are covered by
request signing:

```json
{
  "user": { "id": true, "name": true },
  "$list": {
    "limit": 20,
    "cursor": "eyJpZCI6MTAwfQ",
    "orderBy": [{ "field": "createdAt", "dir": "desc" }],
    "filter": [{ "field": "role", "op": "in", "value": ["admin", "owner"] }]
  }
}
```

Parsing lives in `packages/core/src/parser/index.ts` (`parseListOptions`);
validation in `packages/core/src/planner/validator.ts` (unknown fields,
invalid operators, `limit` capped at 200). `@meshql/client` exposes this as
`client.query(selection, { list: { ... } })`.

### 2.3 Catch-all resolver

`packages/core/src/resolver/registry.ts`:

```ts
class ResolverRegistry {
  register(entity: string | "*", resolver: Resolver): void;
  get(entity: string): Resolver | undefined; // returns specific then falls back to "*"
}
```

Behaviour:

- A specific entity resolver always wins.
- `"*"` is the fallback for any entity that doesn't have one.
- Registering `"*"` twice throws (deterministic ordering).

### 2.4 Resolver receives `list`

Already covered by adding it to `JoinPlan`. Update `Resolver` JSDoc with an
example showing list/filter/order usage.

### 2.5 Postgres helper learns list options

`packages/postgres/src/builder.ts`:

- Build parameterised `WHERE` from filters.
- Build `ORDER BY` from `orderBy`.
- Build `LIMIT` from `list.limit` (cap at 200).
- Decode cursor → add `WHERE id > $cursor` to the WHERE.
- Encode cursor when returning results (caller's responsibility, expose a
  helper).

Cursor format: `base64url(JSON.stringify({ id }))`. Resolver decides what's in
the cursor.

### 2.6 Tests ✅

`packages/core/src/parser/parser.test.ts`:

- Each filter operator parses correctly.
- Unknown operator → `ParseError`.
- `orderBy` parses multi-key with mixed directions.
- `limit` shape validation.

`packages/core/src/resolver/registry.test.ts`:

- Catch-all fires when no specific resolver registered.
- Specific resolver wins over catch-all.
- Double-registration of `"*"` throws.

`packages/postgres/src/builder.test.ts`:

- Filter generates parameterised WHERE.
- Multi-key ORDER BY renders correctly.
- Cursor decoded into WHERE clause.
- Limit and cursor keyset predicate.

### Acceptance ✅

- List reads with `$list` in the signed wire payload work end-to-end against
  the express-postgres example and the SQLite integration suite.
- Catch-all resolver pattern shown in README.

**Release: 0.4.0**

---

## Phase 3 — Native uploads with multipart integrity (~2 weeks) ✅ IMPLEMENTED

> Make `@meshql/upload` actually work. File upload is in the original vision and
> needs to be signed end-to-end, not just at the JSON header level.
>
> **What landed:**
>
> - Real `local` storage; `s3` / `r2` adapters (peer-dep gated on AWS SDK).
> - `busboy` multipart parser in `@meshql/http`; upload routes on Express,
>   Fastify, Hono, and integrity Express router.
> - `mesh.executeUpload()` + `onUpload` plugin hook; integrity checks
>   `contentHash` in the signed wire payload against file bytes.
> - `client.upload({ entity, field, id?, file })` hashes and signs automatically.
> - `examples/express-postgres` avatar upload to `./uploads/`.
> - Unit tests for local storage, multipart, integrity, and `executeUpload`.
> - MinIO CI integration for S3 is deferred (adapter is ready; no service container yet).

### 3.1 Real storage adapters

Replace the stubs in `packages/upload/src/storage/`.

`packages/upload/src/storage/local.ts`:

- Write `file.buffer` to `${directory}/${key}` (mkdir -p as needed).
- Return the canonical key (caller may map to URL).
- `get` reads the file, `delete` unlinks.

`packages/upload/src/storage/s3.ts`:

- Use `@aws-sdk/client-s3` (peer dep so users only install if they use S3).
- `put` calls `PutObjectCommand`; supports content-type from `MeshFile.mimetype`.
- `get` returns a `Buffer` or a presigned URL (config flag).

`packages/upload/src/storage/r2.ts`:

- Cloudflare R2 is S3-compatible — wrap the S3 adapter with an R2-specific
  endpoint config.

Each adapter is a separate file with its own tests. Local is required;
S3 and R2 are peer-dep gated.

### 3.2 Multipart parsing in HTTP adapters

`packages/http/src/transport/multipart.ts`:

- Use `busboy` (small, zero deps in its own right) to stream-parse
  `multipart/form-data`.
- One file part → `MeshFile { buffer, mimetype, originalName, size }`.
- One optional JSON metadata part named `meta` → merged into the resolver
  context.
- Reject early on `Content-Length` > configurable max (default 25 MB).

Wire into Express adapter as middleware on the upload routes.
Add Fastify and Hono ports for parity (each framework has its own multipart
parser; pick the lightest path).

### 3.3 Upload routes

Convention:

```
POST /api/:entity/:id/:field        (attach file to existing record)
POST /api/:entity                    (create record with attached file)
```

`packages/core/src/resolver/registry.ts` already has `registerUpload(path, fn)`.
Tighten the contract:

```ts
type UploadKey = `${string}.${string}`;     // "user.avatar"

interface UploadResolver {
  (file: MeshFile, plan: JoinPlan): Promise<Record<string, unknown>>;
}
```

The path `"user.avatar"` means "uploads to entity `user`, field `avatar`."

### 3.4 Multipart integrity

This is the new contract:

- The signed `X-Mesh-Query` header includes a `contentHash` field for upload
  requests:

  ```json
  { "user": { "avatar": { "upload": true } }, "contentHash": "sha256:..." }
  ```

- The server hashes the received multipart body (file bytes only, not headers)
  during streaming.
- After parsing, the server compares to the hash in the signed payload.
  Mismatch → `IntegrityError`, 401.

This keeps integrity stateless and works with the existing HMAC signing flow.

`packages/integrity/src/plugin.ts` gets an `onUpload` hook (new lifecycle stage)
that runs after parsing but before the upload resolver.

`packages/core/src/plugin/types.ts`: add the hook.

### 3.5 Client SDK uploads

`packages/client/src/client.ts`:

```ts
await client.upload({
  entity: "user",
  id: "123",
  field: "avatar",
  file,          // browser File or Node Buffer + filename
});
```

The client hashes the file (Web Crypto in browser, `node:crypto` in Node),
builds the signed query payload including `contentHash`, then sends multipart.

### 3.6 Tests

`packages/upload/test/local.test.ts`:

- Round-trip a file through local storage.
- Reject oversized file.

`packages/upload/test/s3.integration.test.ts`:

- Round-trip against [MinIO](https://min.io) (S3-compatible, runs in Docker).
- CI service container.

`packages/http/test/multipart.test.ts`:

- Parse single-file multipart.
- Parse with metadata.
- Reject oversize.

`packages/integrity/test/multipart.test.ts`:

- Tampered file body → `IntegrityError`.
- Wrong `contentHash` in signed payload → `IntegrityError`.
- Valid signed upload → resolver receives `MeshFile`.

`packages/client/test/upload.test.ts`:

- End-to-end via a test server.

### Acceptance

- `examples/express-postgres` gains an `avatar` upload route that writes to
  `./uploads/` and stores the path on the user record.
- Tampering the file body returns 401.
- S3 integration test green in CI (MinIO).
- Client SDK uploads from both Node and a browser test (Playwright optional).

**Release: 0.4.0**

---

## Phase 4 — ORM adapters (Prisma, Drizzle, Kysely) (2 weeks)

> The headline unlock. After this, users don't write resolvers by hand for
> common cases.

### 4.1 Preshaped resolver contract

ORM adapters return already-nested data — the shaper should pass it through
instead of flattening and re-nesting. Add an opt-in to the resolver registration:

```ts
mesh.resolve("user", fn, { preshaped: true });
mesh.resolve("*",   prismaResolver(prisma)); // implicitly preshaped
```

Internally:

- If `preshaped: true`, skip `shape()` / `shapeMany()` and pass the resolver's
  return value straight through (after `runOnResult` and `runOnResponse`).
- Type the return value as `Record<string, unknown> | Record<string, unknown>[]`.

This is additive — existing flat-row resolvers keep working.

### 4.2 `meshql-prisma`

New package `packages/prisma/`.

```ts
import { prismaResolver } from "meshql-prisma";
mesh.resolve("*", prismaResolver(prisma));
```

Implementation outline:

```ts
export function prismaResolver(client: PrismaClient): Resolver {
  return async (plan) => {
    const model = (client as any)[plan.rootEntity];

    const select = buildSelect(plan);   // { id: true, tokens: { select: { ... } } }
    const where  = buildWhere(plan);    // from list.filter + context.entityId
    const orderBy = buildOrderBy(plan); // from list.orderBy
    const take   = plan.list?.limit ?? 50;
    const cursor = plan.list?.cursor
      ? { id: decodeCursor(plan.list.cursor) }
      : undefined;

    if (plan.context.entityId !== undefined) {
      return model.findUnique({ where: { id: plan.context.entityId }, select });
    }
    return model.findMany({ select, where, orderBy, take, cursor, skip: cursor ? 1 : 0 });
  };
}
```

Mapping details:

- `plan.fields` (`users.id`, `users.name`) → Prisma `select`.
- `plan.joins[].refName` → Prisma include via `select.{refName}.select`.
- `EntityConfig.columns` maps MeshQL field name → Prisma field name when they
  differ.
- Filter ops: `eq → equals`, `in → in`, `gte → gte`, `like → contains`, etc.

### 4.3 `meshql-drizzle`

Same shape, against Drizzle's relational query builder.

```ts
import { drizzleResolver } from "meshql-drizzle";
import { db, schema } from "./db";

mesh.resolve("*", drizzleResolver(db, schema));
```

Drizzle's `db.query.users.findMany({ with: { tokens: true } })` maps cleanly to
the JoinPlan.

### 4.4 `meshql-kysely`

Lower-level: emit raw SQL via Kysely's expression builder. For users who
explicitly don't want an ORM but want type-safe SQL. Returns flat rows; the
shaper still runs (not preshaped).

Effectively a generalisation of `@meshql/postgres` that also supports MySQL and
SQLite via Kysely's dialect system.

### 4.5 Tests

Each adapter:

- Unit tests for plan → query mapping (no real DB).
- Integration tests against the real DB (Prisma → Postgres + SQLite; Drizzle →
  Postgres; Kysely → Postgres).
- Same query, three adapters, same response (consistency suite).

### 4.6 Demo

Add `examples/express-prisma/`:

- Schema: blog (users, posts, comments, tags).
- One MeshQL config, one resolver line, full CRUD via the routes.
- Reuse the integrity demo: signed queries, role-gated fields.

### Acceptance

- `mesh.resolve("*", prismaResolver(prisma))` works for the blog schema with
  zero hand-written resolvers.
- Same for Drizzle.
- Consistency suite: identical responses from Prisma and Drizzle adapters on
  the same Postgres schema.

**Release: 0.5.0**

---

## Phase 5 — Schema inference from ORMs (1 week)

> Users don't write the MeshQL schema by hand. They import it from their ORM
> and override only what they need to hide or rename.

### 5.1 `schemaFromPrisma`

```ts
import { schemaFromPrisma } from "meshql-prisma";
const schema = await schemaFromPrisma("./prisma/schema.prisma");
```

Implementation: use [`@mrleebo/prisma-ast`](https://github.com/MrLeebo/prisma-ast)
(MIT, mature) to parse `schema.prisma`. Walk models:

- Each `model Foo { … }` → entity `foo`.
- Scalar fields → `fields`.
- Relation fields → `joins`.
  - `posts Post[]` → `many` join.
  - `author User` → `one` join.
- `@id` → `idField`.
- `@map("snake_case")` → `columns` entry.

### 5.2 `schemaFromDrizzle`

Drizzle's table objects are runtime values, no source parsing needed:

```ts
import { schemaFromDrizzle } from "meshql-drizzle";
import * as tables from "./db/schema";
import { relations } from "./db/relations";
const schema = schemaFromDrizzle(tables, relations);
```

Walk each table's columns and relation config.

### 5.3 Override / extend mechanism

```ts
import { extendSchema } from "meshql-core";

const schema = extendSchema(
  await schemaFromPrisma("./prisma/schema.prisma"),
  {
    entities: {
      user: { fields: ["id", "name"] },          // hide email, role
    },
    joins: {
      "user.publicPosts": {                       // add custom join
        entity: "post",
        on: "posts.user_id = users.id AND posts.public = true",
        type: "many",
      },
    },
  },
);
```

`extendSchema` shallow-merges with the override taking precedence per entity.
Field arrays are *replaced* not concatenated — so users can explicitly hide.

### 5.4 Tests

`packages/prisma/test/schema-from-prisma.test.ts`:

- Fixture `schema.prisma` files with progressively richer features:
  - flat scalar fields
  - `@map` directives
  - one-to-many relation
  - many-to-many relation (junction table)
  - composite primary keys (decide: reject, or pick first id?)
- Each fixture → expected `MeshSchema` snapshot.

`packages/drizzle/test/schema-from-drizzle.test.ts`:

- Same coverage against Drizzle table objects.

`packages/core/test/extend-schema.test.ts`:

- Field hiding works.
- Custom join addition works.
- Original schema not mutated.

### 5.5 End-to-end demo

Update `examples/express-prisma/` to use `schemaFromPrisma` instead of the
hand-written schema. The MeshQL config is now:

```ts
const schema = await schemaFromPrisma("./prisma/schema.prisma");
const mesh = createMesh(schema);
mesh.resolve("*", prismaResolver(prisma));
```

Three lines.

### Acceptance

- A 50-line `schema.prisma` becomes a usable `MeshSchema` in one line.
- Field hiding via `extendSchema` works without breaking the resolver.
- Blog demo uses inferred schema and still passes its end-to-end tests.

**Release: 0.7.0** — schema inference from ORMs. Completes the original
“ten-line Express + Prisma” vision from the top of this document.

---

## Slice B — Shaper performance (2 evenings) ✅ DONE

> Cartesian fanout from multiple `many` joins made `shapeRefMany` O(N²).
> Realistic nested queries (100 comments × 20 tags) blocked the event loop.

### B.1 O(N) grouping in `shapeRefMany`

Replace outer-loop + `rows.filter(...)` with a single-pass
`Map<idValue, Row[]>`. Preserve insertion-ordered dedup semantics.

### B.2 `makeFieldReader` for hot loops

Closure factory that pre-computes candidate SQL aliases once and caches
the first hit per reader instance. Used in `shapeMany` root grouping
and `shapeRefMany` child grouping.

### B.3 Regression pins + measurement script

Eight high-fanout shaper tests. `packages/core/scripts/measure-shaper.mjs`
as a throwaway benchmark seed (not wired to CI).

### Acceptance

- Byte-identical response shapes vs 0.7.0.
- ~45–138× median speedup on single-parent heavy fanout (see CHANGELOG).
- All shaper tests pass.

**Release: 0.7.1**

Also shipped in 0.7.1: explicit rejection of cross-entity `list.filter` /
`list.orderBy` field paths (spec + validator).

---

## After Phase 5 — what's left for v1.0

Phases 0–5 plus docs/specs landed the ORM-driven core. The **v0.8 → v1.0**
track above is now the source of truth. Summary of what remains:

| Area | Status | Target |
|---|---|---|
| Documentation + protocol specs | ✅ done | — |
| Showcase + express-prisma demos | ✅ done | more demos in 0.8 |
| Production wire protocol (persisted queries) | 🔄 | 0.8.0 |
| Access cache + core test coverage | 🔄 | 0.8.0 |
| Real-time (SSE + pubsub) + gateway + codemods | 📋 | 0.9.0 |
| Benchmarks, auth adapters, npm org, Go port, integrity audit | 📋 | 1.0.0 |
| API audit + security pass | 📋 | 0.9.0 (prep) / 1.0.0 (freeze) |
| Schema naming polish + stale README fixes | ✅ | this week |

See **This week**, **v0.8.0**, **v0.9.0**, and **v1.0.0** at the top of this doc
for the prioritized checklist.

---

## Cross-cutting concerns

### Testing strategy

Every phase adds tests at three levels:

| Level | Tool | Where |
|---|---|---|
| Unit | vitest | `packages/*/src/*.test.ts` |
| Integration (DB) | vitest + testcontainers / docker-compose | `packages/*/test/*.integration.test.ts` |
| End-to-end (HTTP) | vitest + supertest | `examples/*/test/*.e2e.test.ts` |

Unit tests run on every PR (`pnpm test`). Integration and e2e run on a
separate CI workflow that has Docker available.

### CI

`.github/workflows/ci.yml` evolves through the plan:

- Phase 1: add Postgres 16 service container, run integration tests
- Phase 3: add MinIO service container for S3 tests
- Phase 4: add Prisma + SQLite for ORM coverage

Pin Node to 22 LTS; add 24 to the matrix in Phase 6.

### Documentation surface

| Doc | Created | Maintained from |
|---|---|---|
| Root README | exists | Phase 0 rewrite |
| `docs/run-example.md` | exists | Phase 5 rewrite (ORM inference) |
| `docs/http-adapters.md` | exists | Phase 2 (list params) |
| `docs/jsr-settings.md` | exists | as-is |
| `docs/integrity.md` | Phase 3 | signed multipart explained |
| `docs/orm-adapters.md` | Phase 4 | how to write a custom adapter |
| `docs/schema-inference.md` | Phase 5 | Prisma + Drizzle coverage |
| `docs/comparison.md` | post-Phase 5 | vs PostgREST, Hasura, hand-rolled |
| `ROADMAP.md` | this doc | maintained as phases close |

### Release process

Each phase ends with:

1. Run `pnpm changeset` for every package touched, classified
   (`patch` / `minor` / `major`).
2. `pnpm version-packages` to bump.
3. Tag the meta-release (e.g. `v0.2.0`).
4. `pnpm publish:jsr` and `pnpm publish:npm:pack`.
5. Draft GitHub release with a short summary and migration notes if any
   breaking changes.

### Risk register

| Risk | Mitigation |
|---|---|
| Multi-join correctness keeps surprising us | Property-based tests in Phase 1 (fast-check) over the shaper |
| Prisma / Drizzle internals change | Pin to current major; release patch versions on adapter breakage |
| Multipart integrity is subtle | Write tests *first* in Phase 3; treat the protocol as the spec |
| Plugin API drift before 1.0 | Document and freeze in the v1.0 phase |
| Schema inference doesn't cover edge cases | Ship explicit `extendSchema` from day one so users have an escape hatch |

---

## How to use this roadmap

- Treat phase boundaries as the only places where breaking changes ship.
  Inside a phase, prefer additive changes.
- Open one tracking issue per phase, with the tasks above as a checklist.
- If a phase grows beyond its estimate, split it. Don't let scope creep
  between phases — that's how 0.x libraries never reach 1.0.
- Re-read the Vision snippet at the top of this doc whenever a feature
  proposal arrives. If it doesn't make the snippet shorter, smarter, or
  more honest, push it to post-1.0.
