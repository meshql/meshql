# @meshql/upload

Optional file upload extension for MeshQL servers.

## Install

```bash
npx jsr add @meshql/upload
# or
npm install meshql-upload
```

Published on [JSR](https://jsr.io/@meshql/upload). Also on [npm](https://www.npmjs.com/package/meshql-upload) as `meshql-upload`.

## Example

```ts
import { createMesh } from "@meshql/core";
import { withUpload } from "@meshql/upload";

const mesh = withUpload(createMesh({ entities: {} }), {
  storage: "local",
  localDirectory: "./uploads",
  maxSize: "10mb",
});
```
