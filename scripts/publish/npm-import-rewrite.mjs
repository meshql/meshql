/**
 * Rewrite workspace `@meshql/*` imports to `@meshql-js/*` for npm dist output.
 */
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

export { importRewrites };
