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

  const dependencies = {};
  for (const [dep, specifier] of Object.entries(manifest.dependencies ?? {})) {
    if (dep === "@meshql/typescript-config") {
      continue;
    }

    if (specifier.startsWith("workspace:") && DIR_BY_SCOPE[dep]) {
      const depDir = DIR_BY_SCOPE[dep];
      dependencies[npmName(depDir)] = `^${versionOf(depDir)}`;
      continue;
    }

    if (dep.startsWith("@meshql/")) {
      const depDir = dep.slice("@meshql/".length);
      if (NPM_NAME_BY_DIR[depDir]) {
        dependencies[npmName(depDir)] = `^${versionOf(depDir)}`;
        continue;
      }
    }

    dependencies[dep] = specifier;
  }

  if (Object.keys(dependencies).length > 0) {
    manifest.dependencies = dependencies;
  } else {
    delete manifest.dependencies;
  }

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
