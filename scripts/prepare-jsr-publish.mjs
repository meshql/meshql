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
  const dir = name === "@meshql/core" ? "core" : name === "@meshql/http" ? "http" : null;
  if (!dir) return null;
  const jsr = JSON.parse(fs.readFileSync(path.join(repoRoot, "packages", dir, "jsr.json"), "utf8"));
  return jsr.version;
}

for (const [dep, specifier] of Object.entries(manifest.dependencies ?? {})) {
  if (!specifier.startsWith("workspace:")) continue;
  const version = jsrVersion(dep);
  if (!version) {
    console.error(`Cannot map workspace dependency ${dep} for @meshql/${packageName}`);
    process.exit(1);
  }
  manifest.dependencies[dep] = `jsr:${dep}@^${version}`;
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
