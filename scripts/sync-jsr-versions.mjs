import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const packagesDir = path.join(repoRoot, "packages");

let updated = 0;
let mismatches = 0;

for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) {
    continue;
  }

  const packageDir = path.join(packagesDir, entry.name);
  const packageJsonPath = path.join(packageDir, "package.json");
  const jsrJsonPath = path.join(packageDir, "jsr.json");

  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(jsrJsonPath)) {
    continue;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const jsrJson = JSON.parse(fs.readFileSync(jsrJsonPath, "utf8"));

  if (packageJson.version === jsrJson.version) {
    continue;
  }

  jsrJson.version = packageJson.version;
  fs.writeFileSync(jsrJsonPath, `${JSON.stringify(jsrJson, null, 2)}\n`);
  console.log(`Synced ${entry.name}: jsr.json → ${packageJson.version}`);
  updated += 1;
}

if (process.argv.includes("--check")) {
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageDir = path.join(packagesDir, entry.name);
    const packageJsonPath = path.join(packageDir, "package.json");
    const jsrJsonPath = path.join(packageDir, "jsr.json");

    if (!fs.existsSync(packageJsonPath) || !fs.existsSync(jsrJsonPath)) {
      continue;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const jsrJson = JSON.parse(fs.readFileSync(jsrJsonPath, "utf8"));

    if (packageJson.version !== jsrJson.version) {
      console.error(
        `${entry.name}: package.json (${packageJson.version}) !== jsr.json (${jsrJson.version})`,
      );
      mismatches += 1;
    }
  }

  if (mismatches > 0) {
    process.exit(1);
  }

  console.log("All jsr.json versions match package.json");
  process.exit(0);
}

console.log(updated === 0 ? "All jsr.json versions already in sync" : `Updated ${updated} package(s)`);
