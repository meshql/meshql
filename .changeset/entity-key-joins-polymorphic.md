---
"@meshql/core": minor
"@meshql/sqlite": patch
"@meshql/postgres": patch
"@meshql/docs": patch
---

Canonical join keys are always `{entityKey}.{ref}` (e.g. `comment.author`), including under nested plural paths like `comments`. Selection paths/SQL aliases are unchanged. Hand-written nested keys such as `comments.author` / `posts.author` must be renamed to `comment.author` / `post.author`.

Add polymorphic one-relations via `JoinConfig.polymorphic` + `entities` (type/id columns on the parent). SQL builders emit one LEFT JOIN per target with CASE selects; responses include `$entity`. Docs introspection reports polymorphic joins.
