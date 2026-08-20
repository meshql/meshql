import fs from "node:fs";
import path from "node:path";
import {
  npmName,
  PUBLISH_ORDER,
} from "./publish/config.mjs";
import {
  restoreNpmImports,
  rewriteDistDir,
  rewriteNpmImports,
} from "./publish/npm-import-rewrite.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

const DIR_BY_SCOPE = Object.fromEntries(
  PUBLISH_ORDER.map((dir) => [`@meshql/${dir}`, dir]),
);

function rewriteManifestDeps(manifest, section) {
  if (!manifest[section]) {
    return;
  }

  const next = {};
  for (const [dep, specifier] of Object.entries(manifest[section])) {
    if (dep === "@meshql/typescript-config") {
      continue;
    }

    if (specifier.startsWith("workspace:") && DIR_BY_SCOPE[dep]) {
      const depDir = DIR_BY_SCOPE[dep];
      next[npmName(depDir)] = `^${versionOf(depDir)}`;
      continue;
    }

    if (dep.startsWith("@meshql/")) {
      const depDir = dep.slice("@meshql/".length);
      if (PUBLISH_ORDER.includes(depDir)) {
        next[npmName(depDir)] = `^${versionOf(depDir)}`;
        continue;
      }
    }

    next[dep] = specifier;
  }

  if (Object.keys(next).length > 0) {
    manifest[section] = next;
  } else {
    delete manifest[section];
  }
}

function readManifest(packageDir) {
  const manifestPath = path.join(repoRoot, "packages", packageDir, "package.json");
  return {
    manifestPath,
    manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8")),
  };
}

function versionOf(packageDir) {
  const { manifest } = readManifest(packageDir);
  return manifest.version;
}

function distDirOf(packageDir) {
  return path.join(repoRoot, "packages", packageDir, "dist");
}

/**
 * Rewrite package.json and dist imports for npm publish: @meshql-js/* names,
 * dist-only, semver deps. Workspace `pnpm build` keeps `@meshql/*` in dist
 * so tests resolve; rewrite happens only here.
 */
export function prepareNpmPublish(packageDir) {
  const { manifestPath, manifest } = readManifest(packageDir);
  const backupPath = `${manifestPath}.npm-publish-backup`;

  fs.copyFileSync(manifestPath, backupPath);

  manifest.name = npmName(packageDir);

  rewriteManifestDeps(manifest, "dependencies");
  rewriteManifestDeps(manifest, "peerDependencies");

  delete manifest.devDependencies;

  manifest.files = ["dist", "README.md"];
  manifest.repository = {
    type: "git",
    url: "git+https://github.com/meshql/meshql.git",
    directory: `packages/${packageDir}`,
  };
  manifest.homepage = "https://github.com/meshql/meshql#readme";
  manifest.bugs = {
    url: "https://github.com/meshql/meshql/issues",
  };
  manifest.engines = {
    node: ">=22",
  };
  manifest.publishConfig = {
    access: "public",
  };

  delete manifest.scripts?.["publish:jsr"];

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  rewriteDistDir(distDirOf(packageDir), rewriteNpmImports);
  return { manifest, backupPath, npmName: manifest.name };
}

export function restoreNpmPublish(packageDir) {
  const manifestPath = path.join(repoRoot, "packages", packageDir, "package.json");
  const backupPath = `${manifestPath}.npm-publish-backup`;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, manifestPath);
    fs.unlinkSync(backupPath);
  }
  rewriteDistDir(distDirOf(packageDir), restoreNpmImports);
}

const packageDir = process.argv[2];
const command = process.argv[3] ?? "prepare";

if (process.argv[1]?.endsWith("prepare-npm-publish.mjs")) {
  if (!packageDir) {
    console.error("Usage: node scripts/prepare-npm-publish.mjs <package-dir> [prepare|restore]");
    console.error(`Package dirs: ${PUBLISH_ORDER.join(", ")}`);
    process.exit(1);
  }

  if (command === "restore") {
    restoreNpmPublish(packageDir);
    console.log(`Restored packages/${packageDir}/package.json`);
  } else if (command === "prepare") {
    const { npmName: name, manifest } = prepareNpmPublish(packageDir);
    console.log(`Prepared ${name}@${manifest.version} for npm publish`);
  } else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}
