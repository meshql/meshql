/**
 * Shared tsup options for MeshQL packages.
 * Rewrites `@meshql/*` → `@meshql-js/*` in dist after build for npm consumers.
 */
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "tsup";
import { rewriteNpmImports } from "../../scripts/publish/npm-import-rewrite.mjs";

/**
 * @param {string} distDir
 */
export function rewriteDistDir(distDir) {
  if (!fs.existsSync(distDir)) {
    return;
  }

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }

      if (!/\.(js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/.test(entry.name)) {
        continue;
      }

      const content = fs.readFileSync(full, "utf8");
      const next = rewriteNpmImports(content);
      if (next !== content) {
        fs.writeFileSync(full, next);
      }
    }
  }

  walk(distDir);
}

/**
 * @param {import("tsup").Options | import("tsup").Options[]} options
 */
export function definePackageConfig(options) {
  const list = Array.isArray(options) ? options : [options];

  return defineConfig(
    list.map((opts) => {
      const outDir = opts.outDir ?? "dist";
      const previousOnSuccess = opts.onSuccess;

      return {
        format: ["esm"],
        dts: true,
        clean: true,
        sourcemap: true,
        ...opts,
        async onSuccess() {
          rewriteDistDir(path.resolve(process.cwd(), outDir));
          if (typeof previousOnSuccess === "function") {
            await previousOnSuccess();
          } else if (typeof previousOnSuccess === "string") {
            const { execSync } = await import("node:child_process");
            execSync(previousOnSuccess, { stdio: "inherit" });
          }
        },
      };
    }),
  );
}
