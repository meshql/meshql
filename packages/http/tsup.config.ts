import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/adapters/express-adapter.ts",
    "src/adapters/fastify-adapter.ts",
    "src/adapters/hono-adapter.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
