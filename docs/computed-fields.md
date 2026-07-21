# Computed fields

Computed fields are virtual, server-side fields derived from physical fields.
Clients select them like any other scalar, while MeshQL fetches their
dependencies, computes the value, and hides dependencies that were not
explicitly requested.

## Define a computed field

Add `computed` entries to an entity. Computed names do not belong in `fields`;
that array lists physical resolver or database fields only.

```ts
import { createMesh, type MeshSchema } from "@meshql/core";

const schema: MeshSchema = {
  entities: {
    user: {
      fields: ["id", "firstName", "lastName", "email"],
      table: "users",
      computed: {
        fullName: {
          from: ["firstName", "lastName"],
          compute: ({ firstName, lastName }) =>
            `${firstName ?? ""} ${lastName ?? ""}`.trim(),
          type: "string",
        },
      },
    },
  },
  joins: {},
};

const mesh = createMesh(schema);
```

`createMesh()` validates computed definitions immediately.

## Query a computed field

Computed fields use the same canonical query syntax as physical fields:

```ts
const user = await client.query(
  {
    user: {
      $select: {
        id: true,
        fullName: true,
      },
    },
  },
  { entityId: "1" },
);
```

```json
{
  "id": 1,
  "fullName": "Ada Lovelace"
}
```

The resolver fetch plan includes `firstName` and `lastName`, but the response
does not expose them unless the client also selects them.

## Cross-entity dependencies

A computed field may depend on one physical field through a declared join.
Use a `join.field` dependency:

```ts
const schema: MeshSchema = {
  entities: {
    order: {
      fields: ["id", "customerId"],
      computed: {
        customerLabel: {
          from: ["customer.firstName"],
          compute: (deps) => `Customer: ${deps["customer.firstName"] ?? ""}`,
          type: "string",
        },
      },
    },
    customer: {
      fields: ["id", "firstName"],
    },
  },
  joins: {
    "order.customer": {
      entity: "customer",
      on: "customers.id = orders.customer_id",
      type: "one",
    },
  },
};
```

Selecting `customerLabel` automatically adds the `order.customer` join and its
required physical field to the plan. The client does not need to select the
`customer` relation.

## Nested computed fields

Computed fields can be selected on nested relations:

```ts
const posts = await client.query({
  post: {
    $select: {
      id: true,
      author: {
        $select: {
          fullName: true,
        },
      },
    },
  },
});
```

## Resolver behavior

With flat-row SQL resolvers, use a first-party SQL or ORM adapter, or build from
the supplied `JoinPlan`. MeshQL adds physical dependencies to `plan.fields` and
`plan.joins`; the computed name itself is not treated as a database column.

Preshaped resolvers (`{ preshaped: true }`) must return the dependency fields in
their nested objects. MeshQL computes selected virtual fields and projects the
result back to the requested shape.

## Access control

Computed fields participate in field access rules using their normal path, for
example `user.fullName`. If access strips a computed field, dependencies fetched
only for that field are also removed from the plan. A dependency explicitly
selected by the client remains subject to its own access rule.

## Playground

`@meshql/docs` marks computed fields separately in schema introspection. Set
`type` to `"string"`, `"number"`, or `"boolean"` to expose a useful runtime hint
to introspection consumers. The playground entity browser labels the field as
computed.

## Rules and limitations

- `from` must contain at least one dependency.
- Computed names must not conflict with physical `fields`.
- Dependencies must reference physical fields.
- Computed fields cannot depend on other computed fields.
- Cross-entity dependencies support one declared `join.field` hop.
- `compute` is synchronous and runs once per result row or nested object.
- Computed fields are projection-only. Do not use them in `$where`,
  `$orderBy`, `$groupBy`, `$aggregate`, `$having`, or `$distinct`.
  `$where` rejects them explicitly; SQL controls otherwise require physical
  fields.
- Dependency fields may be fetched internally even when omitted from the
  response.

See the [computed fields specification](../specs/08-computed-fields.md) for the
portable behavior contract.
