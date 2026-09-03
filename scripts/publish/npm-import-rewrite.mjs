/**
 * Rewrite workspace `@meshql/*` imports to `@meshqljs/*` for npm dist output.
 */
import fs from "node:fs";
import path from "node:path";
import { importRewrites } from "./config.mjs";

/**
 * @param {string} content
 * @returns {string}
 */
export function rewriteNpmImports(content) {
  let next = content;
  for (const [from, to] of importRewrites()) {
    if (next.includes(from)) {
      next = next.split(from).join(to);
    }
  }
  return next;
}

/** Inverse of {@link rewriteNpmImports} so restore can put workspace dist back. */
export function restoreNpmImports(content) {
  let next = content;
  for (const [from, to] of importRewrites()) {
    if (next.includes(to)) {
      next = next.split(to).join(from);
    }
  }
  return next;
}

/**
 * Walk a dist directory and apply an import transform to JS/DTS files.
 * @param {string} distDir
 * @param {(content: string) => string} transform
 */
export function rewriteDistDir(distDir, transform) {
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
      const next = transform(content);
      if (next !== content) {
        fs.writeFileSync(full, next);
      }
    }
  }

  walk(distDir);
}

export { importRewrites };
