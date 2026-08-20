import fs from "node:fs";
import path from "node:path";
import { PUBLISH_ORDER } from "./publish/config.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

function toNpmJsrRange(specifier) {
  const trimmed = specifier.trim();
  if (trimmed.includes("||")) {
    const alternatives = trimmed.split("||").map((part) => part.trim());
    return alternatives.at(-1).replace(/^>=/, "^");
  }
  return trimmed.replace(/^>=/, "^");
}

/**
 * Rewrite package.json deps for JSR publish. Call restoreJsrPublish after.
 */
export function prepareJsrPublish(packageName) {
  const packageDir = path.join(repoRoot, "packages", packageName);
  const manifestPath = path.join(packageDir, "package.json");
  const backupPath = `${manifestPath}.jsr-publish-backup`;

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing packages/${packageName}/package.json`);
  }

  fs.copyFileSync(manifestPath, backupPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  function rewriteMeshqlDeps(section) {
    if (!manifest[section]) {
      return;
    }

    for (const [dep, specifier] of Object.entries(manifest[section])) {
      if (!dep.startsWith("@meshql/")) {
        continue;
      }

      const shortName = dep.slice("@meshql/".length);
      const jsrPath = path.join(repoRoot, "packages", shortName, "jsr.json");
      if (!fs.existsSync(jsrPath)) {
        continue;
      }

      const version = JSON.parse(fs.readFileSync(jsrPath, "utf8")).version;
      const range = specifier.startsWith("workspace:") ? `^${version}` : specifier;
      manifest[section][dep] = `npm:@jsr/meshql__${shortName}@${range}`;
    }
  }

  rewriteMeshqlDeps("dependencies");
  rewriteMeshqlDeps("peerDependencies");

  // JSR/Deno needs resolvable package.json dependencies for npm peers that
  // are imported from published TypeScript source.
  if (manifest.peerDependencies) {
    manifest.dependencies ??= {};
    for (const [dep, specifier] of Object.entries(manifest.peerDependencies)) {
      if (dep.startsWith("@meshql/")) {
        continue;
      }
      if (!manifest.dependencies[dep]) {
        const npmRange = toNpmJsrRange(specifier);
        manifest.dependencies[dep] = `npm:${dep}@${npmRange}`;
      }
    }
  }

  delete manifest.devDependencies;

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, backupPath };
}

export function restoreJsrPublish(packageName) {
  const manifestPath = path.join(
    repoRoot,
    "packages",
    packageName,
    "package.json",
  );
  const backupPath = `${manifestPath}.jsr-publish-backup`;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, manifestPath);
    fs.unlinkSync(backupPath);
  }
}

const packageName = process.argv[2];
const command = process.argv[3] ?? "prepare";

if (process.argv[1]?.endsWith("prepare-jsr-publish.mjs")) {
  if (!packageName) {
    console.error(
      "Usage: node scripts/prepare-jsr-publish.mjs <package-dir> [prepare|restore]",
    );
    console.error(`Package dirs: ${PUBLISH_ORDER.join(", ")}`);
    process.exit(1);
  }

  if (command === "restore") {
    restoreJsrPublish(packageName);
    console.log(`Restored packages/${packageName}/package.json`);
  } else if (command === "prepare") {
    prepareJsrPublish(packageName);
    console.log(`Prepared packages/${packageName} for JSR publish`);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}
