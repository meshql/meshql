# MeshQL protocol specifications

Normative, language-agnostic contracts for implementing MeshQL (or a
compatible client/server) outside the TypeScript reference packages.

**Hosted at:** [docs.meshql.dev/specs](https://docs.meshql.dev/specs)

**Audience:** porters and alternative implementations (Go, Rust, Python,
etc.). Application developers should start with the [Guide](https://docs.meshql.dev/guide/introduction).

## Status

| Spec | Wire | Status |
|------|------|--------|
| Protocol version `1` | `X-Mesh-Version: 1` | **Draft → Stable candidate** (matches `@meshql/*` 0.7.x) |

When a MUST requirement here diverges from the TypeScript reference, either
fix the reference or bump the protocol version. Prefer fixtures over prose
when resolving ambiguity.

## Documents

| Doc | Contents |
|-----|----------|
| [00 — Overview](./00-overview.md) | Goals, non-goals, compliance levels |
| [01 — HTTP wire](./01-http-wire.md) | Routes, headers, errors |
| [02 — Query format](./02-query-format.md) | JSON selection + QL |
| [03 — JoinPlan](./03-join-plan.md) | Execution plan shape |
| [04 — Shaper](./04-shaper.md) | Flat rows → nested JSON |
| [05 — List options](./05-list-options.md) | `$list`, cursors, filters |
| [06 — Integrity](./06-integrity.md) | Optional signing profile |
| [07 — Uploads](./07-uploads.md) | Optional multipart profile |
| [Conformance](./conformance.md) | Must-pass cases |
| [Fixtures](./fixtures/) | Golden inputs / outputs |

## Source of truth

- Specs live in this directory (`meshql/specs/`).
- The TypeScript monorepo (`packages/*`) is the **reference implementation**.
- User-facing tutorials stay under `docs/` and [docs.meshql.dev/guide](https://docs.meshql.dev/guide/introduction).

## Change process

1. Propose changes in a PR with fixture updates when possible.
2. Mark breaking wire changes by incrementing `X-Mesh-Version`.
3. Sync to the docs site via `docs` package `npm run sync`.
