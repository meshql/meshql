# Fixtures

Golden inputs for conformance and alternative implementations.

| Path | Purpose |
|------|---------|
| [queries/](./queries/) | Client selection JSON (`X-Mesh-Query` decoded) and selection-only `.ql` files |
| [responses/](./responses/) | Flat rows → expected shaped JSON |

When changing shaper or wire behavior, update these fixtures in the same PR.

`@meshql/core` runs selection/shaper fixtures in CI. The SQLite and Postgres
builders both run `queries/collection-controls.json`, providing a shared
cross-dialect contract for filters, ordering, and sentinel pagination.

`queries/nested-per-parent.json` exercises the nested fetch strategy
(per-parent `$orderBy` / `$page` and a day-bucketed `$groupBy` on a nested
relation). `responses/nested-per-parent.json` maps nested rows — JSON columns
as text (SQLite) or already parsed (Postgres) — to the shaped response; the
SQLite e2e suite runs the same query against a real database.

QL fixtures are selection-only. Use JSON when a query needs `$where`,
`$orderBy`, `$page`, or aggregate controls.
