# @meshql/plugins

SDK for building MeshQL community plugins.

## Custom plugin example

```typescript
import type { MeshPlugin } from "@meshql/plugins";

const tenantIsolation: MeshPlugin = {
  name: "tenant-isolation",

  onPlan(plan, ctx) {
    return {
      ...plan,
      context: {
        ...plan.context,
        tenantId: ctx.queryContext.tenantId,
      },
    };
  },
};

mesh.use(tenantIsolation);
```

## Hook execution order

- `onRequest` → sequential (registration order)
- `onPlan` → sequential
- `onResult` → reverse
- `onResponse` → reverse
- `onError` → all plugins notified
