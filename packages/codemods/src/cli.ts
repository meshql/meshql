#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { migrateGraphqlSdl } from "./index.js";

const args = process.argv.slice(2);
const inputPath = args.find((arg) => !arg.startsWith("-"));
const outDir = args.includes("--out")
  ? args[args.indexOf("--out") + 1]
  : undefined;

if (!inputPath) {
  console.error("Usage: meshql-codemod graphql-sdl <schema.graphql> [--out dir]");
  process.exit(1);
}

const sdl = readFileSync(inputPath, "utf8");
const result = migrateGraphqlSdl(sdl);

console.log("# MeshQL migration report\n");
console.log("## Converted");
for (const line of result.report.converted) {
  console.log(`- ${line}`);
}
console.log("\n## Manual follow-up");
for (const line of result.report.manual) {
  console.log(`- ${line}`);
}

if (outDir) {
  writeFileSync(`${outDir}/schema.ts`, result.schemaSource);
  writeFileSync(`${outDir}/resolvers.ts`, `${result.resolverStubs}\n`);
  writeFileSync(
    `${outDir}/migration-report.json`,
    `${JSON.stringify(result.report, null, 2)}\n`,
  );
  console.log(`\nWrote schema.ts, resolvers.ts, migration-report.json → ${outDir}`);
} else {
  console.log("\n--- schema.ts ---\n");
  console.log(result.schemaSource);
  console.log("--- resolvers.ts ---\n");
  console.log(result.resolverStubs);
}
