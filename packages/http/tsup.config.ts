import { definePackageConfig } from "../../scripts/publish/tsup-package.mjs";

export default definePackageConfig({
  entry: [
    "src/index.ts",
    "src/adapters/express-adapter.ts",
    "src/adapters/fastify-adapter.ts",
    "src/adapters/hono-adapter.ts",
  ],
});
