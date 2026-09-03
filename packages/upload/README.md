# @meshql/upload

Optional file upload extension for MeshQL servers.

## Install

```bash
npm install @meshqljs/upload @meshqljs/core
# or
npx jsr add @meshql/upload @meshql/core
```

Published on [npm](https://www.npmjs.com/package/@meshqljs/upload) as `@meshqljs/upload` and [JSR](https://jsr.io/@meshql/upload) as `@meshql/upload`.

## Example

```ts
import { createMesh } from "@meshqljs/core";
import { withUpload } from "@meshqljs/upload";

const mesh = withUpload(createMesh({ entities: {} }), {
  storage: "local",
  localDirectory: "./uploads",
  maxSize: "10mb",
});
```

JSR imports: `@meshql/core`, `@meshql/upload`.
