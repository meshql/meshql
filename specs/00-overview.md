# 00 — Overview

## Purpose

MeshQL is a **client-driven field selection protocol over REST**. Clients
declare which fields (and nested relations) they want. Servers plan, fetch,
and shape nested JSON. The HTTP surface stays RESTish (paths, methods);
the selection travels in headers or a POST body — not GraphQL ceremony.

This series of specs defines the **portable core** so another language can
implement a compatible server or client.

## Design principles

1. **REST URLs, selection elsewhere** — entity id is in the path; field
   selection is not in the query string.
2. **One plan per request** — parse → JoinPlan → resolver → shape.
3. **Flat fetch, nested respond** — resolvers may return SQL-style aliased
   rows; the shaper builds nesting (unless the resolver is marked preshaped).
4. **Schema is mandatory** — unknown fields and joins MUST be rejected.
5. **Integrity is optional** — signing is a profile, not required for Level 1.

## Non-goals (protocol)

- Owning a SQL dialect or ORM
- GraphQL federation / subscriptions
- Requiring TypeScript
- Mandating Prisma, Drizzle, or any storage technology

## Components of an implementation

```
Client
  → HTTP request (01)
  → Query payload (02)
Server
  → Parse + validate against MeshSchema
  → JoinPlan (03)
  → Resolver (implementation-defined data fetch)
  → Shaper (04) unless already nested
  → JSON response
```

## Compliance levels

| Level | Name | MUST implement |
|-------|------|----------------|
| **L1** | Core | HTTP routes + headers (01), query formats (02), JoinPlan semantics (03), shaper (04), error JSON |
| **L2** | Lists | L1 + `$list` (05) on list routes |
| **L3** | Integrity | L2 + HMAC signing + auth token headers (06) |
| **L4** | Uploads | L3 + multipart upload routes + `contentHash` (07) |

An implementation MAY claim a level only if it passes the corresponding
[conformance](./conformance.md) cases (and fixtures where provided).

## Protocol version

Clients SHOULD send `X-Mesh-Version: 1`. Servers MUST accept missing version
as `1` until a later major is published. Incompatible changes require a new
version number.
