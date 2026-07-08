---
title: FAQ
description: Frequently asked questions about MeshQL — GraphQL comparison, security, access control, migration, and more.
---

> These questions came from real developers evaluating MeshQL.
> If your question isn't here, [open a discussion on GitHub](https://github.com/meshql/meshql/discussions).

## General

### What is MeshQL?

MeshQL is a lightweight TypeScript API layer that lets clients request exactly the fields they need — including nested joins — without GraphQL's resolvers, dataloaders, or codegen. You write one SQL query per entity (or use an ORM catch-all resolver). MeshQL shapes the response.

### Is MeshQL a GraphQL replacement?

Not for every use case. MeshQL replaces GraphQL when:

- You control both client and server
- You want optimal DB queries without ceremony
- Your team knows SQL and REST already
- You want HTTP caching to just work

GraphQL still wins when:

- You need a public API for external developers
- You need introspection or self-documenting schema
- You need real-time subscriptions
- You're federating across many microservices

### What's the actual advantage of MeshQL over GraphQL?

Same feature, very different cost.

<details>
<summary><strong>Field selection</strong></summary>

```
GraphQL  → schema file + resolver per field + codegen for types
MeshQL   → your existing TS types + one resolver per entity
```

</details>

<details>
<summary><strong>Nested data (user + tokens + business)</strong></summary>

```
GraphQL  → three resolvers run independently
           N+1 queries by default
           dataloaders required to fix it

MeshQL   → one resolver
           one SQL join (or one ORM query)
           N+1 structurally impossible
           no dataloaders, ever
```

</details>

<details>
<summary><strong>Adding a new field</strong></summary>

```
GraphQL  → schema → regenerate types → resolver → wire dataloader
MeshQL   → add to TS interface → add to SQL query → done
```

</details>

<details>
<summary><strong>HTTP caching</strong></summary>

```
GraphQL  → always POST, never cached by CDN or browser
MeshQL   → GET requests, cached automatically by CDN and browser
```

</details>

<details>
<summary><strong>New team member learning curve</strong></summary>

```
GraphQL  → GraphQL spec + resolver pattern + dataloader pattern + codegen setup
MeshQL   → one function: resolve() + SQL you already know
```

</details>

### What is the N+1 problem and how does MeshQL solve it?

In GraphQL, fields resolve independently. Fetching a list of users with their tokens means:

- One query for users
- Then one query **per user** for their tokens

The community's answer is dataloaders — a clever solution to a problem that a JOIN solved in 1974.

MeshQL flips this entirely. The client's query is parsed into a `JoinPlan` that tells you exactly which fields and joins were requested. You write one SQL JOIN (or one ORM relational query). One query, always. N+1 is structurally impossible — not patched, not batched, just gone.

See [Concepts](/guide/concepts) and [JoinPlan spec](/specs/join-plan).

### Does MeshQL work with existing REST APIs?

Yes. MeshQL runs alongside your existing REST routes. You add it to an existing Express, Fastify, or Hono server in minutes. Migrate endpoint by endpoint — nothing breaks.

### Is SQLite supported?

Yes, fully — as of v0.5.2. `@meshql/sqlite` provides the same `buildSelectSql()` API as `@meshql/postgres`. The single-query guarantee holds on SQLite too, making MeshQL a great fit for:

- Local development
- Edge runtimes
- Cloudflare D1
- Embedded applications

## ORM and schema

### Do I have to hand-write the schema?

No. As of v0.7.0 you can infer it:

- `schemaFromPrisma()` / `schemaFromPrismaSource()` from `@meshql/prisma`
- `schemaFromDrizzle()` from `@meshql/drizzle`

Hand-written schemas still work — and are the right choice for raw SQL with `@meshql/postgres` or `@meshql/sqlite`. See [ORM adapters](/guide/orm-adapters).

### Can I use MeshQL without writing SQL?

Yes. `@meshql/prisma`, `@meshql/drizzle`, and `@meshql/kysely` each provide a catch-all resolver (`mesh.resolve("*", …)`). MeshQL maps the client's field selection to your ORM's query API. The raw SQL path remains when you want full control over the query.

### Who owns the database connection?

**You do.** MeshQL never opens connection pools or creates ORM clients. Pass your existing `PrismaClient`, `pg.Pool`, Kysely instance, or Drizzle db once at startup. See [Database connections](/guide/database-connections).

### Does MeshQL replace my ORM?

No. MeshQL sits above it (or above raw SQL). Your ORM still owns migrations, models, and transactions. MeshQL only handles query parsing, access checks, and response shaping.

### What happens if a client requests a field I didn't join?

The planner only includes fields the client asked for. If your resolver doesn't fetch a branch, the shaper returns `null` or omits it — no error for optional nested data. Your resolver should align SQL/ORM selects with `plan.fields` and `plan.joins`.

## Runtime and tooling

### Does the client work in the browser?

Yes. `@meshql/client` encodes queries, signs them (when integrity is enabled), and works in Node or the browser. See [meshql-client](/packages/client).

### JSR vs npm — which do I use?

Same packages, two registries:

| Registry | Scope / prefix | Example |
|----------|----------------|---------|
| [JSR](https://jsr.io/@meshql) | `@meshql/*` | `@meshql/core` |
| [npm](https://www.npmjs.com/search?q=meshql-) | `meshql-*` | `meshql-core` |

Pick what your runtime prefers. Bun and Deno often use JSR; Node projects often use npm. Both are first-class.

### Does MeshQL run on Bun, Deno, and edge?

Yes for Bun and Deno — see [integrations](/integrations/bun). For edge, the SQLite path (`@meshql/sqlite`) targets Cloudflare D1 and similar. Postgres on edge depends on your host's driver support; MeshQL itself is runtime-agnostic TypeScript.

### How do mutations work?

Reads use **GET** with the shaped query in `X-Mesh-Query` (cacheable). Creates, updates, and deletes use normal **POST**, **PUT**, and **DELETE** on `/mesh/:entity` routes with JSON or multipart bodies. Integrity signing applies to mutations too when enabled. See [HTTP adapters](/reference/http-adapters).

## Transport

### Why use a header instead of POST body or URL query params?

Three reasons:

**1. Character safety**

URL query params break on dots, brackets, and special characters that are common in nested field names like `user.tokens.accessToken`. Base64 in a header has zero character issues, ever.

**2. Cacheability**

POST requests are never cached by CDN or browser, by spec. GET requests with `X-Mesh-Query` headers are cacheable — your CDN can cache shaped responses automatically. For read-heavy APIs this is a significant performance win.

**3. Query integrity**

A header-based query can be signed (via `X-Mesh-Signature`) without mixing auth concerns into the URL or body. Queries in URL params also appear in plain text in server logs and browser history.

See [HTTP wire spec](/specs/http-wire).

### Why can't we just use POST for everything?

POST has TLS encryption — but that's not what the header design is solving. TLS protects data in transit (nobody can intercept). The header design solves character safety, cacheability, and query integrity — completely different concerns.

That said, MeshQL does use POST — for mutations (creating records). GET is for reads. This is correct HTTP semantics, not an arbitrary choice.

### Is the base64 query encrypted?

No — base64 is encoding, not encryption. The query is readable if decoded. Encryption is handled by HTTPS/TLS at the transport layer.

If you need query integrity (tamper protection + trusted client verification), add `@meshql/integrity` which signs queries with HMAC. If you need the query hidden from logs, the header design keeps the raw query out of URLs entirely.

## Security

### Does HTTPS make the integrity package unnecessary?

They solve different problems:

```
HTTPS protects:      data in transit — nobody can intercept
Integrity protects:  data at origin  — request came from YOUR client
                     data shape      — query was not tampered with
                     replay attacks  — captured requests can't be resent
```

HTTPS alone:

- Eve cannot read the request ✅
- Eve can still craft her own valid request ❌
- Mallory can replay a captured request ❌
- A rogue script can send arbitrary queries ❌

HTTPS + Integrity:

- Eve cannot read the request ✅
- Eve cannot craft a trusted request ✅
- Mallory cannot replay (token expiry) ✅
- Rogue scripts have no signing token ✅

### Do I need the integrity package?

It depends on your threat model:

```
Internal API, controlled clients, behind VPN
→ skip integrity, access control is enough

Public API, exposed to internet
→ integrity is recommended

Sensitive data (financial, medical, personal)
→ integrity + access both, strongly recommended

Need CSRF protection on mutations?
→ integrity handles this automatically
```

### Does integrity work for all HTTP methods?

Yes — and the value is different per method:

**GET** — highest value. Prevents schema probing, arbitrary query crafting, and DB stress from unknown clients.

**POST** — confirms request came from your actual client before any record creation happens.

**PUT** — unsigned PUT rejected immediately, never reaches field write access checks or DB.

**DELETE** — most critical. Integrity makes CSRF attacks on DELETE impossible. An unsigned DELETE never reaches your resolver, period.

### Does MeshQL implement authentication?

No — and this is by design. MeshQL never verifies passwords, implements OAuth/SAML/OIDC, or calls any auth provider's API. It sits **after** authentication, not instead of it.

You plug in your existing auth via a single `identify()` function:

```typescript
withIntegrity(mesh, {
  secret: process.env.MESH_SECRET,
  identify: async (req) => {
    const session = await auth0.getSession(req) // or Clerk, Firebase, your own JWT
    if (!session) return null
    return { userId: session.user.id, role: session.user.role }
  },
})
```

Works with Auth0, Clerk, Firebase, Cognito, your own JWT, SSO, SAML — anything that produces a verified identity.

### Where does the signing secret come from? Is it sent to the client?

The master secret **never leaves the server. Ever.**

What the client receives is a short-lived **signing token** — derived from the master secret but not the secret itself. It's tied to a specific user and session, and expires (15 minutes by default).

```
Master secret  → server only, never moves
Signing token  → derived, limited, sent to client after login
                 useless without the master secret
                 expires fast
                 tied to userId + sessionId
```

If the signing token is compromised, the attacker can only act as that user for up to 15 minutes. The master secret remains safe.

## Access control

### What levels of access control does @meshql/access support?

Four levels, all independent and composable:

**Method level** — can this user call PUT or DELETE at all?

```typescript
methods: {
  user: {
    GET: (ctx) => true,
    DELETE: (ctx) => ctx.role === 'admin',
  },
}
```

**Entity level** — can this user query this entity at all?

```typescript
entities: {
  business: (ctx) => ctx.role !== 'guest',
}
```

**Row level** — can this user access this specific record?

```typescript
rows: {
  user: async (ctx, entityId) => ctx.userId === entityId,
}
```

**Field level** — separate read and write control per field:

```typescript
fields: {
  read: {
    'user.salary': (ctx) => ctx.role === 'hr',
  },
  write: {
    'user.role': (ctx) => ctx.role === 'admin',
    'user.salary': (ctx) => ctx.role === 'hr',
  },
}
```

### Can I restrict specific fields from being updated by certain users?

Yes — field write access strips disallowed fields from the request body **before your resolver sees them.** The DB is never touched for restricted fields.

```typescript
fields: {
  write: {
    'user.role': (ctx) => ctx.role === 'admin',
    'user.verifiedAt': () => false,
    'user.email': (ctx) => ctx.userId === ctx.entityId,
  },
}
```

Restricted fields are silently stripped — no error thrown, no information leaked about what's protected.

### Can I have per-user rules, not just per-role?

Yes — `userRules` supports async, per-user logic including DB calls:

```typescript
userRules: {
  'user.phoneNumber': async (ctx, entityId) => {
    const areFriends = await db.friendships.exists({
      userId: ctx.userId,
      friendId: entityId,
    })
    return areFriends || ctx.userId === entityId
  },
}
```

### What's returned when access is denied — an error or silent strip?

Depends on what was denied:

```
Method denied      → 403  (HTTP standard, method is known)
Entity denied      → 403
Row denied         → 404  (don't reveal the record exists)
Field read denied  → silent strip (don't reveal field exists)
Field write denied → silent strip (don't reveal field is protected)
```

404 for row-level denial is intentional — returning 403 would confirm the record exists, which is itself an information leak.

## Migration

### Can I migrate from GraphQL incrementally?

Yes — MeshQL runs alongside GraphQL on the same server. You don't rip anything out:

```typescript
// existing GraphQL stays untouched
app.use('/graphql', graphqlHandler)

// MeshQL added alongside
app.use('/mesh', meshExpressRouter(mesh, '/mesh'))
```

Suggested path:

```
Week 1-2  → new endpoints go to /mesh only
Week 3-4  → migrate least complex GraphQL queries
Month 2   → migrate resolvers with N+1 pain (biggest win)
Month 3+  → retire GraphQL entirely (optional)
```

### Is there a tool to convert a GraphQL schema to MeshQL?

`@meshql/codemods` is on the roadmap. It will read your GraphQL SDL and output a MeshQL schema config, resolver stubs, and a migration report showing what was converted automatically and what needs manual attention.

For now the mapping is mechanical:

```
GraphQL type          → MeshQL entity
GraphQL object field  → MeshQL join
GraphQL resolver      → MeshQL resolve() function
GraphQL dataloader    → not needed, covered by join
GraphQL mutation      → PUT/POST/DELETE route
GraphQL subscription  → not supported
```

### How long does a typical GraphQL migration take?

For a medium-sized GraphQL API — one weekend to migrate the first entities, then never think about dataloaders again. Complexity varies with access rules and custom scalars.

## Packages

### What's the difference between builtins and plugins?

**Builtins** ship with `@meshql/core`, are tree-shakeable, and cover the 80% case:

- Basic HMAC integrity
- Role-based field access
- Depth limit
- Complexity limit
- Rate limit
- Logger

**Plugins** are opt-in separate packages for the remaining 20%:

- `@meshql/integrity` — full token lifecycle, per-session signing
- `@meshql/access` — advanced field, row, entity, method access
- `@meshql/upload` — file uploads
- `@meshql/codemods` — GraphQL migration tool (coming soon)

Install only what you need. Core stays tiny. See [Packages](/packages).

### Will MeshQL support other languages like Go or Python?

Yes — sequenced after the TypeScript API stabilizes toward v1.0. The **protocol is already specced** at [docs.meshql.dev/specs](/specs) with golden fixtures and a [conformance](/specs/conformance) checklist. Go, Python, and Rust ports can implement against that spec and pass the compliance suite. The TypeScript repo is the reference implementation.

Go is the natural second target — Go developers feel the same GraphQL ceremony pain, and MeshQL's "write one SQL query" message lands even harder there.

If you're interested in building a Go port, watch the main repo and the spec pages for `meshql-go` announcements.

### Is there a conformance suite for other language ports?

Yes. The [conformance spec](/specs/conformance) describes required behavior. Golden query and response JSON fixtures ship alongside the spec for automated port testing.

---

*Have a question not covered here? [Open a discussion](https://github.com/meshql/meshql/discussions) on GitHub.*
