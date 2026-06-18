# @meshql/upload

Optional file upload extension for MeshQL servers.

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
