#!/usr/bin/env node
/**
 * Resolve which packages/registries to publish from a tag or workflow_dispatch.
 *
 * Usage:
 *   node scripts/publish/resolve.mjs --event tag --ref refs/tags/npm/core/v0.11.0
 *   node scripts/publish/resolve.mjs --event workflow_dispatch --package core --registry both
 *
 * Writes GitHub Actions outputs when GITHUB_OUTPUT is set; always prints JSON.
 */
import fs from "node:fs";
import {
  packagesForSelection,
  parseTag,
  WORKFLOW_DISPATCH_OPTIONS,
} from "./config.mjs";

function parseArgs(argv) {
  const args = {
    event: "tag",
    ref: "",
    package: "all",
    registry: "both",
    publish: true,
  };

  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[i + 1];
    switch (key) {
      case "--event":
        args.event = value;
        i++;
        break;
      case "--ref":
        args.ref = value;
        i++;
        break;
      case "--package":
        args.package = value;
        i++;
        break;
      case "--registry":
        args.registry = value;
        i++;
        break;
      case "--publish":
        args.publish = value !== "false";
        i++;
        break;
      case "--help":
        console.log(`Usage: node scripts/publish/resolve.mjs [options]
  --event tag|workflow_dispatch
  --ref refs/tags/...
  --package <name|all|security>
  --registry npm|jsr|both
  --publish true|false`);
        process.exit(0);
        break;
      default:
        break;
    }
  }

  return args;
}

function setOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) {
    return;
  }

  const serialized =
    typeof value === "string" ? value : JSON.stringify(value);

  if (serialized.includes("\n")) {
    fs.appendFileSync(outputPath, `${name}<<EOF\n${serialized}\nEOF\n`);
    return;
  }

  fs.appendFileSync(outputPath, `${name}=${serialized}\n`);
}

function registriesFromInput(registry) {
  switch (registry) {
    case "npm":
      return ["npm"];
    case "jsr":
      return ["jsr"];
    case "both":
      return ["npm", "jsr"];
    default:
      throw new Error(`Unknown registry: ${registry} (expected npm|jsr|both)`);
  }
}

const args = parseArgs(process.argv.slice(2));

let selection;
let registries;
let tagVersion = "";
let releaseTag = "";

if (args.event === "workflow_dispatch") {
  selection = args.package;
  if (!WORKFLOW_DISPATCH_OPTIONS.includes(selection)) {
    console.error(`::error::Unknown package selection: ${selection}`);
    process.exit(1);
  }
  registries = registriesFromInput(args.registry);
  releaseTag = `manual-${process.env.GITHUB_RUN_ID ?? Date.now()}`;
} else {
  const tag = args.ref.replace(/^refs\/tags\//, "");
  releaseTag = tag;
  try {
    const parsed = parseTag(tag);
    selection = parsed.selection;
    registries = parsed.registries;
    tagVersion = parsed.tagVersion;
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}

let packages;
try {
  packages = packagesForSelection(selection, {
    fullAll: args.event === "workflow_dispatch",
  });
} catch (error) {
  console.error(`::error::${error.message}`);
  process.exit(1);
}

const matrixInclude = packages.flatMap((pkg) =>
  registries.map((registry) => ({ package: pkg, registry })),
);

const result = {
  packages,
  registries,
  tagVersion,
  releaseTag,
  publish: args.publish,
  matrix: { include: matrixInclude },
};

setOutput("packages", packages);
setOutput("registries", registries);
setOutput("tag_version", tagVersion);
setOutput("release_tag", releaseTag);
setOutput("publish", String(args.publish));
// GitHub Actions matrix.include expects an array
setOutput("matrix", matrixInclude);

console.log(JSON.stringify(result, null, 2));
