---
"@meshql/core": minor
"@meshql/postgres": minor
"@meshql/sqlite": minor
"@meshql/http": minor
"@meshql/client": minor
"@meshql/upload": minor
"@meshql/integrity": minor
"@meshql/access": minor
"@meshql/plugins": minor
---

v0.2.0: split SQL builders into `@meshql/postgres` and `@meshql/sqlite`, improve shaper join handling, and refresh HTTP adapters.

- **Breaking:** `buildSelectSql` removed from `@meshql/core` — import from `@meshql/postgres` or `@meshql/sqlite` instead.
- **New:** `@meshql/postgres` (`meshql-postgres`) with Postgres `$1, $2, …` placeholders and integration tests.
- **New:** `@meshql/sqlite` (`meshql-sqlite`) with `?` placeholders for `node:sqlite` / Bun / D1.
- **New:** `examples/express-sqlite` — zero-Docker SQLite demo.
- **Improved:** shaper handles multi-many joins, left joins, and qualified row keys more reliably.
- **Improved:** plugin runner and rate-limit plugin; HTTP adapter cleanup.
