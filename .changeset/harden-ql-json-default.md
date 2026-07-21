---
"@meshql/core": minor
"@meshql/http": minor
"@meshql/client": patch
"@meshql/gateway": patch
---

Make JSON the default query format everywhere and harden selection-only QL.
`mesh.execute()` and `POST /mesh` now default to `json` (matching GET headers
and `@meshql/client`). Pass `{ format: "ql" }` or `"format": "ql"` explicitly
for brace syntax. The QL parser now rejects unsupported characters, trailing
content, missing outer braces, and empty selections.
