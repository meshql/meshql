---
"@meshql/core": minor
"@meshql/prisma": minor
"@meshql/postgres": patch
"@meshql/sqlite": patch
---

Add many-to-many support via optional `JoinConfig.through`.

SQL builders emit a two-hop join (parent → junction → child) using
`emitJoinSql`, with collision-safe junction aliases and physical id columns
from `entityIdField` / `columns`. Prisma implicit M2M (`Post.tags` / `Tag.posts`)
is detected as `_AToB` with `A`/`B` columns.
