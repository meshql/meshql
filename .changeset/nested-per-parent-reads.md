---
"@meshql/core": minor
"@meshql/postgres": minor
"@meshql/sqlite": minor
"@meshql/client": patch
"@meshql/docs": patch
---

Per-parent relation controls and bucketed `$groupBy`. When a `many` relation carries explicit `$where` / `$orderBy` / `$page` / `$groupBy` / `$aggregate`, the planner picks `plan.strategy = "nested"` and `buildSelectSql` renders each relation as a correlated JSON subquery (still one statement), so controls apply per parent row and the root `$page` counts root rows. Plain selections keep the flat LEFT JOIN plan.

`$groupBy` keys may be `{ field, bucket?, as? }` with `bucket` in `hour | day | week | month | year`. On a nested `many` relation, grouping buckets the per-parent record window into `[{ <keys>, <aggregates>, items: [...] }]`. Root aggregates support buckets and ordering by group alias.

Validation is stricter: group/aggregate fields must exist, aggregate aliases and `as` names must be identifiers, and nested `$page.after`, nested `$having`, and nested `$aggregate` without `$groupBy` are rejected.
