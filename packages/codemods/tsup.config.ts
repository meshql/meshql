import { definePackageConfig } from "../../scripts/publish/tsup-package.mjs";

export default definePackageConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
});
