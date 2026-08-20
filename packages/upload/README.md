# @meshql/upload

Optional file upload extension for MeshQL servers.

## Install

```bash
npm install @meshql-js/upload @meshql-js/core
# or
npx jsr add @meshql/upload @meshql/core
```

Published on [npm](https://www.npmjs.com/package/@meshql-js/upload) as `@meshql-js/upload` and [JSR](https://jsr.io/@meshql/upload) as `@meshql/upload`.

## Example

```ts
import { createMesh } from "@meshql-js/core";
import { withUpload } from "@meshql-js/upload";

const mesh = withUpload(createMesh({ entities: {} }), {
  storage: "local",
  localDirectory: "./uploads",
  maxSize: "10mb",
});
```

JSR imports: `@meshql/core`, `@meshql/upload`.
