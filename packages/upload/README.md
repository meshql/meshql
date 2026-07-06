# @meshql/upload

Optional file upload extension for MeshQL servers.

## Install

```bash
npm install meshql-upload meshql-core
# or
npx jsr add @meshql/upload @meshql/core
```

Published on [npm](https://www.npmjs.com/package/meshql-upload) as `meshql-upload` and [JSR](https://jsr.io/@meshql/upload) as `@meshql/upload`.

## Example

```ts
import { createMesh } from "meshql-core";
import { withUpload } from "meshql-upload";

const mesh = withUpload(createMesh({ entities: {} }), {
  storage: "local",
  localDirectory: "./uploads",
  maxSize: "10mb",
});
```

JSR imports: `@meshql/core`, `@meshql/upload`.
