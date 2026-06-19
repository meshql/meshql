import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");

/** Monorepo directory → npm package name (unscoped; @meshql org unavailable on npm). */
const NPM_NAME_BY_DIR = {
  core: "meshql-core",
  http: "meshql-http",
  client: "meshql-client",
  upload: "meshql-upload",
  integrity: "meshql-integrity",
  access: "meshql-access",
  plugins: "meshql-plugins",
};

const DIR_BY_SCOPE = Object.fromEntries(
  Object.keys(NPM_NAME_BY_DIR).map((dir) => [`@meshql/${dir}`, dir]),
);

const PUBLISH_ORDER = [
  "core",
  "http",
  "upload",
  "client",
  "integrity",
  "access",
  "plugins",
];

/** Longest paths first so @meshql/core/builtins is rewritten before @meshql/core. */
const IMPORT_REWRITES = [
  ["@meshql/core/builtins", "meshql-core/builtins"],
  ["@meshql/core", "meshql-core"],
  ["@meshql/http", "meshql-http"],
  ["@meshql/client", "meshql-client"],
  ["@meshql/upload", "meshql-upload"],
  ["@meshql/integrity", "meshql-integrity"],
  ["@meshql/access", "meshql-access"],
  ["@meshql/plugins", "meshql-plugins"],
];

function rewriteDistImports(packageDir) {
  const distDir = path.join(repoRoot, "packages", packageDir, "dist");
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

      if (!/\.(js|d\.ts)$/.test(entry.name)) {
        continue;
      }

      let content = fs.readFileSync(full, "utf8");
      let changed = false;

      for (const [from, to] of IMPORT_REWRITES) {
        if (!content.includes(from)) {
          continue;
        }
        content = content.split(from).join(to);
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(full, content);
      }
    }
  }

  walk(distDir);
}

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
      if (NPM_NAME_BY_DIR[depDir]) {
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

function npmName(packageDir) {
  const name = NPM_NAME_BY_DIR[packageDir];
  if (!name) {
    throw new Error(`Unknown package directory: ${packageDir}`);
  }
  return name;
}

function versionOf(packageDir) {
  const { manifest } = readManifest(packageDir);
  return manifest.version;
}

/**
 * Rewrite package.json for npm publish: meshql-* names, dist-only, semver deps.
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
  rewriteDistImports(packageDir);
  return { manifest, backupPath, npmName: manifest.name };
}

export function restoreNpmPublish(packageDir) {
  const manifestPath = path.join(repoRoot, "packages", packageDir, "package.json");
  const backupPath = `${manifestPath}.npm-publish-backup`;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, manifestPath);
    fs.unlinkSync(backupPath);
  }
}

const packageDir = process.argv[2];
const command = process.argv[3] ?? "prepare";

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
