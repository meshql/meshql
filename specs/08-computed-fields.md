# 08 — Computed fields

**Status:** Draft optional capability  
**Applies to:** Implementations that expose schema-defined computed fields

Computed fields are queryable scalar fields produced after resolver data is
fetched. They are declared by the server and use the normal `$select` query
syntax; no additional wire control is introduced.

## Schema definition

A computed field definition has:

| Field | Type | Meaning |
|---|---|---|
| `from` | non-empty string array | Physical dependencies relative to the owning entity |
| `compute` | synchronous function | Produces the value from a dependency map |
| `type` | optional string | Runtime hint: `string`, `number`, or `boolean` |

Same-entity dependencies use a field name such as `firstName`. A cross-entity
dependency uses one declared relation hop such as `customer.firstName`.

## Query behavior

The computed name is selected like a scalar:

```json
{
  "user": {
    "$select": {
      "id": true,
      "fullName": true
    }
  }
}
```

An implementation supporting computed fields:

1. MUST treat declared computed names as queryable fields.
2. MUST add required physical dependencies and joins to the fetch plan.
3. MUST NOT treat the computed name as a physical database column.
4. MUST evaluate only computed fields requested by the query.
5. MUST omit dependency fields from the response unless the query also
   selected them.
6. MUST support computed fields at root and nested relation nodes.

## Definition validation

Implementations MUST reject:

- A computed name that conflicts with a physical field.
- An empty dependency list.
- A missing or non-callable compute function.
- A same-entity dependency that is not a declared physical field.
- A dependency on another computed field.
- A cross-entity dependency whose relation or target physical field is
  unknown.
- A cross-entity dependency deeper than one `relation.field` hop.

## Resolver paths

For flat-row resolvers, dependencies MUST be fetched under aliases compatible
with the normal shaper. Computation occurs before final response shaping.

For preshaped resolvers, dependency fields MUST be present in the returned
objects. Computation occurs before projection to the requested response shape.

## Access control

Access rules MAY deny a computed field by its normal schema path. When denied,
dependencies fetched only for that computed field SHOULD be removed from the
plan. Dependencies explicitly selected by the client remain independently
subject to access rules.

## Read controls

Computed fields are projection-only in the current protocol. Clients MUST NOT
reference them from filters, sorting, distinct, grouping, aggregation, or
having expressions. The TypeScript reference rejects computed fields in
`$where`; SQL-backed controls otherwise require physical fields. Implementations
SHOULD reject unsupported computed control references during planning.

## Introspection

Schema introspection SHOULD distinguish physical and computed fields. If a
computed definition declares a runtime `type` hint, introspection SHOULD expose
it.

## Result example

Given `fullName.from = ["firstName", "lastName"]`:

```json
{
  "id": 1,
  "fullName": "Ada Lovelace"
}
```

`firstName` and `lastName` are absent unless explicitly selected.
