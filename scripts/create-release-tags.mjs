import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const packagesDir = path.join(repoRoot, "packages");

function run(command, options = {}) {
  const stdio = options.stdio ?? "pipe";
  const result = execSync(command, { cwd: repoRoot, encoding: "utf8", stdio });
  if (stdio === "inherit") {
    return;
  }
  return (result ?? "").trim();
}

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  if (value.includes("\n")) {
    fs.appendFileSync(outputPath, `${name}<<EOF\n${value}\nEOF\n`);
    return;
  }

  fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

function configureGitRemote() {
  const token = process.env.RELEASE_PAT ?? process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    return;
  }

  run(
    `git remote set-url origin https://x-access-token:${token}@github.com/${repo}.git`,
  );
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
  const diff = run(`git diff --name-only ${parent} HEAD -- packages/`)
    .split("\n")
    .filter(Boolean);
  const bumped = new Map();

  for (const rel of diff) {
    if (!rel.endsWith("package.json") && !rel.endsWith("jsr.json")) {
      continue;
    }

    const pkgDir = path.basename(path.dirname(rel));
    const packageJsonPath = path.join(packagesDir, pkgDir, "package.json");
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const current = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    if (current.private) {
      continue;
    }

    const previousPath = `${parent}:${path.join("packages", pkgDir, "package.json")}`;
    let previous;
    try {
      previous = JSON.parse(run(`git show ${previousPath}`));
    } catch {
      bumped.set(pkgDir, current.version);
      continue;
    }

    if (previous.version !== current.version) {
      bumped.set(pkgDir, current.version);
    }
  }

  return [...bumped.entries()].map(([pkg, version]) => ({ pkg, version }));
}

function buildPublishMatrix(tags) {
  return tags.flatMap((tag) => {
    if (tag.startsWith("npm/")) {
      const pkg = tag.split("/")[1];
      return [
        {
          workflow: "publish-npm.yml",
          package: pkg,
          ref: tag,
        },
      ];
    }

    const pkg = tag.split("/")[0];
    return [
      {
        workflow: "publish-jsr.yml",
        package: pkg,
        ref: tag,
      },
    ];
  });
}

configureGitRemote();

const bumped = getBumpedPackages();

if (bumped.length === 0) {
  console.log("No package version bumps in latest commit — skipping tag creation");
  setOutput("tags_pushed", "false");
  setOutput("publish_matrix", "[]");
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
  setOutput("tags_pushed", "false");
  setOutput("publish_matrix", "[]");
  process.exit(0);
}

run(`git push origin ${tagsToPush.map((tag) => `"${tag}"`).join(" ")}`, {
  stdio: "inherit",
});
console.log(`Pushed ${tagsToPush.length} tag(s)`);

setOutput("tags_pushed", "true");
setOutput("publish_matrix", JSON.stringify(buildPublishMatrix(tagsToPush)));
