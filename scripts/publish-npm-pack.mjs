import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PUBLISH_ORDER } from "./publish/config.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const artifacts = path.join(repoRoot, "artifacts");

fs.mkdirSync(artifacts, { recursive: true });

for (const pkg of PUBLISH_ORDER) {
  execSync(`node scripts/prepare-npm-publish.mjs ${pkg}`, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  execSync(`npm pack --pack-destination ../../artifacts`, {
    cwd: path.join(repoRoot, "packages", pkg),
    stdio: "inherit",
  });
  execSync(`node scripts/prepare-npm-publish.mjs ${pkg} restore`, {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

console.log("\nTarballs in artifacts/:");
for (const file of fs.readdirSync(artifacts).filter((f) => f.endsWith(".tgz"))) {
  console.log(`  ${file}`);
}
