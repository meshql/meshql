# Conformance

Use this checklist when claiming MeshQL protocol compatibility.

Reference implementation: [github.com/meshql/meshql](https://github.com/meshql/meshql) `@meshql/*` packages.

## Level 1 — Core

- [ ] `GET /:entity/:id` with `X-Mesh-Query` + `X-Mesh-Format: json` returns 200 JSON
- [ ] Missing `X-Mesh-Query` returns 400 `TransportError`
- [ ] Unknown field returns 400 `ValidationError`
- [ ] Nested relation selection returns nested JSON (shaper or equivalent)
- [ ] Multi-level nesting (`a.b.c`) returns correct nesting (not flattened away)
- [ ] QL format accepted when `X-Mesh-Format: ql`
- [ ] `POST /` accepts `{ "query", "format" }` body

Pass fixtures: [fixtures/queries](./fixtures/queries/), [fixtures/responses](./fixtures/responses/).

## Level 2 — Lists

- [ ] `GET /:entity` with `$list.limit` respects clamp (≤ 200)
- [ ] `$list.filter` with `eq` / `in` applied or cleanly rejected if unsupported
- [ ] `$list.orderBy` applied or cleanly rejected
- [ ] List metadata is **not** required via URL querystring

## Level 3 — Integrity

- [ ] `POST /auth` returns token material
- [ ] Valid HMAC on `X-Mesh-Query` accepted
- [ ] Tampered base64 query rejected
- [ ] Logout revokes token

## Level 4 — Uploads

- [ ] Multipart upload routes accept `file` part
- [ ] `contentHash` mismatch rejected when signing enabled

## Reporting

Publish which level you claim and the MeshQL protocol version tested
(`X-Mesh-Version: 1`). Linking fixture diffs in your CI is encouraged.
