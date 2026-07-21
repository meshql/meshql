---
"@meshql/core": patch
---

Fix `$aggregate` aliases missing from collection responses and use group keys for aggregate ORDER BY/cursors.

Previously grouped queries dropped aliases like `total` because the record shaper only projected `$select` fields. Aggregate reads also incorrectly tied pagination to the row `id`. Aggregate mode now projects group keys plus named aggregates, and default ordering/cursors use `$groupBy` fields.
