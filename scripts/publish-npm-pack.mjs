import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(repoRoot, "artifacts");
const packages = [
  "core",
  "postgres",
  "sqlite",
  "http",
  "upload",
  "client",
  "integrity",
  "access",
  "plugins",
];

fs.mkdirSync(artifacts, { recursive: true });

for (const pkg of packages) {
  execSync(`node scripts/prepare-npm-publish.mjs ${pkg}`, { cwd: repoRoot, stdio: "inherit" });
  execSync(`npm pack --pack-destination ../../artifacts`, {
    cwd: path.join(repoRoot, "packages", pkg),
    stdio: "inherit",
  });
  execSync(`node scripts/prepare-npm-publish.mjs ${pkg} restore`, { cwd: repoRoot, stdio: "inherit" });
}

console.log("\nTarballs in artifacts/:");
for (const file of fs.readdirSync(artifacts).filter((f) => f.endsWith(".tgz"))) {
  console.log(`  ${file}`);
}
