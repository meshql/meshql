# 02 — Query format

**Status:** Draft (protocol v1)  
**Applies to:** Compliance Level 1+

The query declares **which root entity and fields** (including nested refs)
the client wants. It does not contain the entity id (that is in the URL) or
untrusted filters outside `$list` (see [05](./05-list-options.md)).

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
    "id": true,
    "name": true,
    "tokens": {
      "accessToken": true
    }
  }
}
```

Nested multi-level:

```json
{
  "post": {
    "id": true,
    "title": true,
    "comments": {
      "id": true,
      "body": true,
      "author": {
        "id": true,
        "name": true
      }
    }
  }
}
```

### Rules

1. Scalar fields MUST be selected with boolean `true` (or omitted). Servers
   SHOULD reject unknown keys that are not relations or `$list`.
2. Relation fields MUST be objects (possibly empty object meaning relation
   requested with no scalars — implementations SHOULD still require valid
   nested fields per schema).
3. Exactly one root entity selection SHOULD be present for point/list routes
   matching `:entity`. Extra roots MAY be rejected.
4. Sibling key `$list` is reserved (L2). See [05 — List options](./05-list-options.md).

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
