import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/adapters/express.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  onSuccess() {
    const uiDir = join("dist", "ui");
    mkdirSync(uiDir, { recursive: true });
    copyFileSync(join("ui", "playground.html"), join(uiDir, "playground.html"));
  },
});
