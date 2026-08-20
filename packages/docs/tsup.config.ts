import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { definePackageConfig } from "../../scripts/publish/tsup-package.mjs";

export default definePackageConfig({
  entry: ["src/index.ts", "src/adapters/express.ts"],
  onSuccess() {
    const uiDir = join("dist", "ui");
    mkdirSync(uiDir, { recursive: true });
    copyFileSync(join("ui", "playground.html"), join(uiDir, "playground.html"));
  },
});
