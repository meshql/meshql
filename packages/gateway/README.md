# meshql-gateway

Static multi-service MeshQL gateway (V1) — route queries by entity, parallel fetch, stitch cross-service joins.

## Install

```bash
npm install meshql-gateway meshql-client meshql-core
# or
npx jsr add @meshql/gateway @meshql/client @meshql/core
```

## Example

```ts
import { createGateway } from "@meshql/gateway";

const gateway = createGateway({
  schema: { entities: { /* … */ }, joins: { /* … */ } },
  services: [
    { name: "users", baseUrl: "http://localhost:3001/mesh", entities: ["user"] },
    { name: "posts", baseUrl: "http://localhost:3002/mesh", entities: ["post"] },
  ],
});

const user = await gateway.execute('{"user":{"id":true,"posts":{"title":true}}}', {
  entityId: "1",
});
```

V1 uses static service config. Dynamic discovery and full join planning across services will expand in later releases.
