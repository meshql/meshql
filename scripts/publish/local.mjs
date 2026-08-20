#!/usr/bin/env node
/**
 * Local publish helper (same paths as CI).
 *
 * Usage:
 *   node scripts/publish/local.mjs --registry jsr --package core --dry-run
 *   node scripts/publish/local.mjs --registry npm --package core --dry-run
 *   node scripts/publish/local.mjs --registry both --package core
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { npmName, PUBLISH_ORDER } from "./config.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function parseArgs(argv) {
  const args = {
    registry: "both",
    package: "",
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--registry":
        args.registry = argv[++i];
        break;
      case "--package":
        args.package = argv[++i];
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      default:
        break;
    }
  }
  return args;
}

function run(command, options = {}) {
  execSync(command, { cwd: repoRoot, stdio: "inherit", ...options });
}

const args = parseArgs(process.argv.slice(2));

if (!args.package || !PUBLISH_ORDER.includes(args.package)) {
  console.error(
    `Usage: node scripts/publish/local.mjs --package <${PUBLISH_ORDER.join("|")}> --registry npm|jsr|both [--dry-run]`,
  );
  process.exit(1);
}

const registries =
  args.registry === "both"
    ? ["npm", "jsr"]
    : args.registry === "npm" || args.registry === "jsr"
      ? [args.registry]
      : null;

if (!registries) {
  console.error(`Unknown registry: ${args.registry}`);
  process.exit(1);
}

const pkg = args.package;

if (registries.includes("npm")) {
  console.log(`\n── npm ${npmName(pkg)} ──`);
  try {
    run(`node scripts/prepare-npm-publish.mjs ${pkg}`);
    if (args.dryRun) {
      run(`npm pack`, { cwd: path.join(repoRoot, "packages", pkg) });
    } else {
      run(`npm publish --access public`, {
        cwd: path.join(repoRoot, "packages", pkg),
      });
    }
  } finally {
    run(`node scripts/prepare-npm-publish.mjs ${pkg} restore`);
  }
}

if (registries.includes("jsr")) {
  console.log(`\n── jsr @meshql/${pkg} ──`);
  try {
    run(`node scripts/prepare-jsr-publish.mjs ${pkg}`);
    const dry = args.dryRun ? " --dry-run" : "";
    run(`npx jsr publish --allow-dirty${dry}`, {
      cwd: path.join(repoRoot, "packages", pkg),
    });
  } finally {
    run(`node scripts/prepare-jsr-publish.mjs ${pkg} restore`);
  }
}

console.log("\nDone.");
