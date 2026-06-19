import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const packageName = process.argv[2];

if (!packageName) {
  console.error("Usage: node scripts/prepare-jsr-publish.mjs <package-dir>");
  process.exit(1);
}

const packageDir = path.join(repoRoot, "packages", packageName);
const manifestPath = path.join(packageDir, "package.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function jsrVersion(name) {
  if (!name.startsWith("@meshql/")) {
    return null;
  }

  const dir = name.slice("@meshql/".length);
  const jsrPath = path.join(repoRoot, "packages", dir, "jsr.json");
  if (!fs.existsSync(jsrPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(jsrPath, "utf8")).version;
}

function rewriteWorkspaceDeps(section) {
  if (!manifest[section]) {
    return;
  }

  for (const [dep, specifier] of Object.entries(manifest[section])) {
    if (!specifier.startsWith("workspace:")) {
      continue;
    }

    const version = jsrVersion(dep);
    if (!version) {
      console.error(`Cannot map workspace dependency ${dep} for @meshql/${packageName}`);
      process.exit(1);
    }

    const shortName = dep.slice("@meshql/".length);
    manifest[section][dep] = `npm:@jsr/meshql__${shortName}@^${version}`;
  }
}

rewriteWorkspaceDeps("dependencies");
rewriteWorkspaceDeps("peerDependencies");

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
