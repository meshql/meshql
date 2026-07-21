---
"@meshql/core": minor
"@meshql/docs": patch
---

Add schema-native computed fields in `@meshql/core`.

Declare virtual fields with `EntityConfig.computed` (`from` + `compute`). The planner expands physical deps (including cross-entity joins), excludes computed names from SQL, and the execute path applies values on flat and preshaped results. Access denials strip computed fields and only their unrequested deps. Docs introspection lists computed keys with `kind: "computed"`.
