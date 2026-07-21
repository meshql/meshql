---
"@meshql/core": minor
"@meshql/prisma": patch
"@meshql/drizzle": patch
"@meshql/codemods": patch
---

Remove the dead `EntityConfig.type` placeholder from schemas before the 1.0 API freeze.

Schema definitions, generated schema output, and examples no longer include `type: {}` or `type: {} as T`; delete those placeholders when upgrading. This is a source-level cleanup only and does not add runtime value coercion.
