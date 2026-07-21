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

QL fixtures are selection-only. Use JSON when a query needs `$where`,
`$orderBy`, `$page`, or aggregate controls.
