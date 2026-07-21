# 07 — Uploads profile (optional)

**Status:** Draft  
**Applies to:** Compliance Level 4+

File uploads use `multipart/form-data` plus the same Mesh headers as reads.
Integrity (L3) SHOULD be enabled so `contentHash` in the query payload can
bind the signed statement to the file bytes.

## Routes

| Method | Path | Meaning |
|--------|------|---------|
| `POST` | `/{base}/:entity/:id/:field` | Attach file to existing entity field |
| `POST` | `/{base}/:entity` | Upload that creates a record |

## Multipart

- Part name for the file: `file` (conventional)
- Optional metadata part: implementation-defined (TS uses `meta`)

## Query / contentHash

When integrity is on, the decoded query JSON MUST include a `contentHash`
(hex digest of file bytes) covered by `X-Mesh-Signature`. The server MUST
reject uploads whose file hash does not match.

## Response

Success JSON shape is implementation-defined (at least enough to identify
stored object: URL / id / hash). Document it per implementation.

## Storage

Storage backends (local disk, S3, R2) are **out of scope** for this wire
spec — only the HTTP + hash binding is normative for L4.
