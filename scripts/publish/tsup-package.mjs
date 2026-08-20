/**
 * Shared tsup options for MeshQL packages.
 * Dist keeps workspace `@meshql/*` imports so tests resolve via pnpm.
 * npm publish rewrites those imports in prepare-npm-publish.mjs.
 */
import { defineConfig } from "tsup";

/**
 * @param {import("tsup").Options | import("tsup").Options[]} options
 */
export function definePackageConfig(options) {
  const list = Array.isArray(options) ? options : [options];

  return defineConfig(
    list.map((opts) => ({
      format: ["esm"],
      dts: true,
      clean: true,
      sourcemap: true,
      ...opts,
    })),
  );
}
