import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Root directory for `public/`, `uploads/`, and `ui/` assets.
 *
 * - Dev (`tsx src/…`): package root (parent of `src/`)
 * - Standalone zip (`server.mjs`): directory containing the bundle
 * - Override: `SHOWCASE_ASSET_ROOT`
 */
export function assetRoot(moduleUrl: string = import.meta.url): string {
  if (process.env.SHOWCASE_ASSET_ROOT) {
    return path.resolve(process.env.SHOWCASE_ASSET_ROOT);
  }

  const dir = path.dirname(fileURLToPath(moduleUrl));
  const base = path.basename(dir);

  // Running from compiled/source under examples/showcase/src
  if (base === "src") {
    return path.resolve(dir, "..");
  }

  // Bundled server.mjs (or any file) sits next to public/ and uploads/
  return dir;
}

export function publicDir(moduleUrl?: string): string {
  return path.join(assetRoot(moduleUrl), "public");
}

export function uploadsDir(moduleUrl?: string): string {
  return path.join(assetRoot(moduleUrl), "uploads");
}
