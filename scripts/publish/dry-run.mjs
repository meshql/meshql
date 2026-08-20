#!/usr/bin/env node
/**
 * Dry-run npm pack + jsr publish for publishable packages (no registry writes).
 *
 * Usage:
 *   node scripts/publish/dry-run.mjs --all
 *   node scripts/publish/dry-run.mjs --package core
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PUBLISH_ORDER } from "./config.mjs";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const artifacts = path.join(repoRoot, "artifacts", "dry-run");

function parseArgs(argv) {
  const args = { all: false, packages: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--all") {
      args.all = true;
    } else if (argv[i] === "--package") {
      args.packages.push(argv[++i]);
    }
  }
  return args;
}

function run(command, options = {}) {
  execSync(command, {
    cwd: repoRoot,
    stdio: "inherit",
    ...options,
  });
}

const args = parseArgs(process.argv.slice(2));
const packages = args.all
  ? [...PUBLISH_ORDER]
  : args.packages.length > 0
    ? args.packages
    : [...PUBLISH_ORDER];

fs.mkdirSync(artifacts, { recursive: true });

let failed = false;

for (const pkg of packages) {
  console.log(`\n══ Dry-run ${pkg} ══`);

  try {
    run(`node scripts/prepare-npm-publish.mjs ${pkg}`);
    run(`npm pack --pack-destination "${artifacts}"`, {
      cwd: path.join(repoRoot, "packages", pkg),
    });
  } catch (error) {
    console.error(`npm pack failed for ${pkg}:`, error.message);
    failed = true;
  } finally {
    run(`node scripts/prepare-npm-publish.mjs ${pkg} restore`);
  }

  try {
    run(`node scripts/verify-jsr-publish.mjs --local-only ${pkg}`);
    run(`node scripts/prepare-jsr-publish.mjs ${pkg}`);
    run(`npx jsr publish --dry-run --allow-dirty`, {
      cwd: path.join(repoRoot, "packages", pkg),
    });
  } catch (error) {
    console.error(`jsr dry-run failed for ${pkg}:`, error.message);
    failed = true;
  } finally {
    run(`node scripts/prepare-jsr-publish.mjs ${pkg} restore`);
  }
}

if (failed) {
  console.error("\nPublish dry-run failed");
  process.exit(1);
}

console.log("\nPublish dry-run passed for:", packages.join(", "));
