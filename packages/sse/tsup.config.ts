import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/express": "src/adapters/express.ts",
    "adapters/fastify": "src/adapters/fastify.ts",
    "adapters/hono": "src/adapters/hono.ts",
  },
  external: ["express", "fastify", "hono"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
