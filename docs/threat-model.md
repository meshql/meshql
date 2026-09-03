# Threat model

Structured self-audit of MeshQL as it heads toward 1.0. This is not a third-party penetration test. Findings that change the wire protocol are called out as **limitations**, not silent behavior changes.

## What MeshQL guarantees

MeshQL is a query engine and HTTP layer in front of **your** resolvers and database. It:

- Parses and validates a field-selection query against a schema you define
- Plans joins and shapes nested JSON
- Optionally **HMAC-signs** the exact `X-Mesh-Query` header (`@meshql/integrity`)
- Optionally **strips fields** by role or rule (`@meshql/access`)
- Parameterizes SQL in first-party Postgres / SQLite / Kysely builders

It does **not**:

- Replace TLS
- Replace your identity provider (passwords, OAuth, JWT verification)
- Authorize rows unless you configure `@meshql/access` (or equivalent)
- Prevent replay of a captured signed request before the signing token expires

## Trust boundaries

```
Browser / SDK
    │  TLS
    ▼
HTTP adapter (@meshql/http or integrity router)
    │  decode X-Mesh-Query, optional HMAC + token
    ▼
Plugins (integrity, access, rate-limit, docs execute, …)
    │  JoinPlan
    ▼
Your resolver (SQL builder, Prisma, Drizzle, custom)
    ▼
Database / object storage
```

Anything on the far side of the resolver is the application’s responsibility: SQL injection in hand-written queries, overly broad ORM `select`, storage ACLs, and secrets in logs.

## Integrity (`@meshql/integrity`)

**Protects:** tampering of the query header; requests that were never issued a session token.

**How:** HMAC-SHA256 over the **exact** `X-Mesh-Query` string, keyed by a per-session signing token derived from a server-only master secret. Tokens carry `expiresAt` (default TTL **15m**). `POST /logout` revokes the session in the token store.

**Does not protect:**

| Issue | Status |
|-------|--------|
| Replay of a captured `(query, signature, token)` triple | **Known limitation.** Valid until `expiresAt` or revoke. No per-request nonce or signed timestamp on the wire. |
| In-process `mesh.execute()` with no `transport` | Integrity plugin **skips** verification (docs playground, server-side calls). |
| Authorization | Use `@meshql/access`. A signed query can still request fields the role must not see unless access strips them. |
| Compromised signing token | Attacker can sign any query as that user until expiry/revoke. |

### Replay — recommended controls (no wire change)

Per-request nonces would be an **additive** header (or a breaking HMAC input). They are deferred so existing clients keep working. Until then:

1. Keep `tokenTTL` short in production (default `15m` is a starting point).
2. Serve only over HTTPS so capturing a triple is not a network sniff.
3. Call `revokeSession` on logout; use a shared `TokenStore` across instances.
4. Prefer `@meshql/persisted-queries` allowlists so only registered query IDs run.
5. Do not put secrets in the query document; treat it as cacheable, loggable metadata.

See [spec 06](../specs/06-integrity.md).

## Access (`@meshql/access`)

Field- and entity-level rules run at plan time. Denied fields are stripped so resolvers never fetch them. Access is **not** integrity: an unsigned server with `auth: false` on the playground can still execute whatever the schema allows.

`@meshql/access-cache` caches permission decisions. Treat TTL and invalidation as part of your authorization story (stale allow is a policy bug, not an HMAC bug).

## SQL and ORM adapters

First-party `buildSelectSql` paths bind filter/order values as parameters. Custom `on:` join SQL and hand-written resolvers can still concatenate untrusted input — that is out of MeshQL’s control.

`sql: "dev"` on `@meshql/docs` returns SQL + params in execute responses. Never enable that on a public production playground.

## Uploads (`@meshql/upload`)

Signed upload payloads include `contentHash` (`sha256:…` of file bytes). The integrity plugin compares that hash to the received body. Metadata in a multipart `meta` part is **not** the HMAC message; keep it non-sensitive or fold it into the signed query document.

## Playground (`@meshql/docs`)

| Setting | Risk |
|---------|------|
| `auth: false` (default) | Anyone who can hit `/docs/execute` runs queries as your resolvers. Warns when `NODE_ENV=production`. |
| In-process execute | No `X-Mesh-*` transport → integrity does not verify. Gate with `auth`. |
| `sql: "dev"` | Leaks SQL and bound params (and can reveal table/column names). Default off in production. |

Pass `X-Mesh-Role` / `X-Mesh-User-Id` (or execute-body `context`) so access plugins see the same identity as your API.

## Gateway

`@meshql/gateway` stitches trusted downstream MeshQL services. Compromise or overly broad schema on a downstream service is a federated data leak. Do not point the gateway at untrusted origins.

## Hardening checklist

- [ ] TLS everywhere; HSTS at the edge
- [ ] `withIntegrity` on public HTTP; short TTL; revoke on logout
- [ ] `@meshql/access` (or equivalent) for every sensitive field
- [ ] Persisted queries in production if the client set is known
- [ ] Playground `auth` required in production; `sql` not `"dev"`
- [ ] Rate limit / complexity / depth plugins on public endpoints
- [ ] Token store shared across replicas (not only `InMemoryTokenStore`)
- [ ] Uploads: size limits, content-type allowlist, storage ACLs

Report vulnerabilities via [SECURITY.md](../SECURITY.md).
