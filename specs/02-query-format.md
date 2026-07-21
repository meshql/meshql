# 02 — Query format

**Status:** Draft  
**Applies to:** Compliance Level 1+

The query declares the root entity, selected fields and nested refs. JSON reads
may also include the controls defined in [05 — Read controls](./05-read-controls.md).
The entity id remains in the URL or request context.

## Formats

| `X-Mesh-Format` / body `format` | Value |
|---------------------------------|--------|
| `json` | JSON object selection (default for GET when omitted in some clients; servers MUST treat missing format as `json` for header transport unless documented otherwise — the TS reference defaults header format to `json`) |
| `ql` | Brace / GraphQL-like selection string |

## JSON selection

### Shape

A single root key naming the entity (or matching the path entity), with
nested objects for relations and `true` for scalars:

```json
{
  "user": {
    "$select": {
      "id": true,
      "name": true,
      "tokens": {
        "$select": { "accessToken": true }
      }
    }
  }
}
```

Nested multi-level:

```json
{
  "post": {
    "$select": {
      "id": true,
      "title": true,
      "comments": {
        "$select": {
          "id": true,
          "body": true,
          "author": {
            "$select": { "id": true, "name": true }
          }
        }
      }
    }
  }
}
```

### Rules

1. Scalar fields MUST be selected with boolean `true` or omitted.
2. Relation fields MUST be read-node objects with a non-empty selection.
3. Exactly one root entity MUST be present.
4. `$select` is canonical. Non-`$` keys on a read node MAY be used as selection
   shorthand.
5. Unknown fields, joins, and `$` controls MUST be rejected.
6. QL remains selection-only; use JSON for read controls.

## QL selection

Brace syntax reminiscent of GraphQL field sets:

```
{ user { id name tokens { accessToken } } }
```

Multi-level:

```
{ post { id title comments { id body author { id name } } } }
```

### Informal grammar

```
query      := "{" selection "}"
selection  := IDENT "{" field* "}"
field      := IDENT | IDENT "{" field* "}"
```

Whitespace is insignificant. Identifiers are the same strings as MeshSchema
entity/field/ref names.

## Relationship to schema

Servers MUST validate the query against a `MeshSchema` (entities, fields,
joins). Unknown fields or joins → `ValidationError`.

## Fixtures

See [fixtures/queries](./fixtures/queries/).
