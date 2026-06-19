import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const packagesDir = path.join(repoRoot, "packages");

function run(command, options = {}) {
  return execSync(command, { cwd: repoRoot, encoding: "utf8", stdio: options.stdio ?? "pipe" }).trim();
}

function tagExists(tag) {
  try {
    run(`git rev-parse "refs/tags/${tag}"`);
    return true;
  } catch {
    return false;
  }
}

function getBumpedPackages() {
  const parent = run("git rev-parse HEAD^");
  const diff = run(`git diff --name-only ${parent} HEAD -- packages/`).split("\n").filter(Boolean);
  const bumped = [];

  for (const rel of diff) {
    if (!rel.endsWith("package.json")) {
      continue;
    }

    const pkgDir = path.basename(path.dirname(rel));
    const current = JSON.parse(fs.readFileSync(path.join(repoRoot, rel), "utf8"));

    if (current.private) {
      continue;
    }

    let previous;
    try {
      previous = JSON.parse(run(`git show ${parent}:${rel}`));
    } catch {
      continue;
    }

    if (previous.version !== current.version) {
      bumped.push({ pkg: pkgDir, version: current.version });
    }
  }

  return bumped;
}

const bumped = getBumpedPackages();

if (bumped.length === 0) {
  console.log("No package version bumps in latest commit — skipping tag creation");
  process.exit(0);
}

const tagsToPush = [];

for (const { pkg, version } of bumped) {
  for (const tag of [`npm/${pkg}/v${version}`, `${pkg}/v${version}`]) {
    if (tagExists(tag)) {
      console.log(`Tag ${tag} already exists, skipping`);
      continue;
    }

    run(`git tag ${tag}`, { stdio: "inherit" });
    tagsToPush.push(tag);
    console.log(`Created tag ${tag}`);
  }
}

if (tagsToPush.length === 0) {
  console.log("All release tags already exist");
  process.exit(0);
}

run(`git push origin ${tagsToPush.join(" ")}`, { stdio: "inherit" });
console.log(`Pushed ${tagsToPush.length} tag(s)`);
