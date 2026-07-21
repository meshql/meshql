---
"@meshql/client": minor
"@meshql/core": minor
---

Use one canonical JSON query shape across the client, wire protocol, and docs.
Every read node now requires `$select`; shorthand fields outside `$select` are
rejected. `client.query()` accepts that canonical query object directly, with
read controls on the node and only transport metadata such as `entityId` in
the second argument.
