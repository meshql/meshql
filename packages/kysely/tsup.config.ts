import { definePackageConfig } from "../../scripts/publish/tsup-package.mjs";

export default definePackageConfig({
  entry: ["src/index.ts"],
  external: ["@meshql/core", "@meshql/postgres", "@meshql/sqlite", "kysely"],
});
