import { definePackageConfig } from "../../scripts/publish/tsup-package.mjs";

export default definePackageConfig({
  entry: ["src/index.ts", "src/builtins/index.ts"],
});
