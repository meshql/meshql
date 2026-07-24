# @meshql/access

Entity, row, and field access control for MeshQL.

## Install

```bash
npm install meshql-access meshql-core
# or
npx jsr add @meshql/access @meshql/core
```

Published on [npm](https://www.npmjs.com/package/meshql-access) as `meshql-access` and [JSR](https://jsr.io/@meshql/access) as `@meshql/access`.

## Example

```ts
import { createMesh } from "@meshql/core";
import { withAccess } from "@meshql/access";

const mesh = createMesh({
  entities: {
    user: { fields: ["id", "email"], table: "users" },
    admin: { fields: ["id"], table: "admins" },
  },
});

withAccess(mesh, {
  entityAccess: {
    admin: (ctx) => ctx.role === "superadmin",
  },
  rowAccess: {
    user: (ctx, entityId) => ctx.userId === entityId,
  },
  rules: {
    "user.email": (ctx) => ctx.role === "admin",
  },
});
```

JSR imports: `@meshql/core`, `@meshql/access`.
