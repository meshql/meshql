import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/express": "src/adapters/express.ts",
  },
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
