import { definePackageConfig } from "../../scripts/publish/tsup-package.mjs";

export default definePackageConfig({
  entry: {
    index: "src/index.ts",
    "adapters/express": "src/adapters/express.ts",
    "adapters/fastify": "src/adapters/fastify.ts",
    "adapters/hono": "src/adapters/hono.ts",
  },
  external: ["express", "fastify", "hono"],
});
