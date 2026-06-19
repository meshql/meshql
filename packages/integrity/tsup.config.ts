import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/adapters/express.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
  