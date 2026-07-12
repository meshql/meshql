import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const packagesDir = path.join(repoRoot, "packages");

const packages = process.argv.slice(2);
const tagVersion = process.env.TAG_VERSION ?? "";

if (packages.length === 0) {
  console.error("Usage: node scripts/verify-jsr-publish.mjs <package>...");
  process.exit(1);
}

function jsrShortName(fullName) {
  return fullName.startsWith("@meshql/")
    ? fullName.slice("@meshql/".length)
    : fullName;
}

function readManifest(pkg) {
  const manifestPath = path.join(packagesDir, pkg, "jsr.json");
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: false,
      error: `Missing packages/${pkg}/jsr.json`,
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      error: `Invalid JSON in packages/${pkg}/jsr.json: ${error.message}`,
    };
  }

  if (!manifest.name?.startsWith("@meshql/")) {
    return {
      ok: false,
      error: `packages/${pkg}/jsr.json must set name to @meshql/${pkg}`,
    };
  }

  if (!manifest.version) {
    return {
      ok: false,
      error: `packages/${pkg}/jsr.json is missing version`,
    };
  }

  if (!manifest.exports) {
    return {
      ok: false,
      error: `packages/${pkg}/jsr.json is missing exports`,
    };
  }

  if (tagVersion && manifest.version !== tagVersion) {
    return {
      ok: false,
      error: `Tag version ${tagVersion} does not match packages/${pkg}/jsr.json version ${manifest.version}`,
    };
  }

  return { ok: true, manifest };
}

async function jsrPackageExists(shortName) {
  const metaUrl = `https://jsr.io/@meshql/${shortName}/meta.json`;
  const metaResponse = await fetch(metaUrl, { redirect: "follow" });
  if (metaResponse.status === 200) {
    return true;
  }

  // Newly registered packages have no versions yet, so meta.json 404s until
  // the first publish. The package page still exists.
  const pageUrl = `https://jsr.io/@meshql/${shortName}`;
  const pageResponse = await fetch(pageUrl, { redirect: "follow" });
  return pageResponse.status === 200;
}

let failed = false;

for (const pkg of packages) {
  const result = readManifest(pkg);
  if (!result.ok) {
    console.error(`::error::${result.error}`);
    failed = true;
    continue;
  }

  const shortName = jsrShortName(result.manifest.name);
  const exists = await jsrPackageExists(shortName);
  if (!exists) {
    console.error(
      `::error::JSR package @meshql/${shortName} is not registered. Create it at https://jsr.io/new?scope=meshql&package=${shortName} then link meshql/meshql in package Settings → GitHub repository.`,
    );
    failed = true;
    continue;
  }

  console.log(`Verified @meshql/${shortName}@${result.manifest.version}`);
}

if (failed) {
  process.exit(1);
}
