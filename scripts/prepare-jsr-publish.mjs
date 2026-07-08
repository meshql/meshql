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
// are imported from published TypeScript source. Promote those peers into
// dependencies for the publish rewrite (restore happens via git checkout
// on each CI job; local runs should restore packages/*/package.json).
if (manifest.peerDependencies) {
  manifest.dependencies ??= {};
  for (const [dep, specifier] of Object.entries(manifest.peerDependencies)) {
    if (dep.startsWith("@meshql/")) {
      continue;
    }
    if (!manifest.dependencies[dep]) {
      // Deno/JSR rejects open ranges like ">=0.30.0" in npm: specifiers.
      const npmRange = specifier.replace(/^>=/, "^");
      manifest.dependencies[dep] = `npm:${dep}@${npmRange}`;
    }
  }
}

delete manifest.devDependencies;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
