# Fixtures

Golden inputs for conformance and alternative implementations.

| Path | Purpose |
|------|---------|
| [queries/](./queries/) | Client selection JSON (`X-Mesh-Query` decoded) |
| [responses/](./responses/) | Flat rows → expected shaped JSON |

When changing shaper or wire behavior, update these fixtures in the same PR.
