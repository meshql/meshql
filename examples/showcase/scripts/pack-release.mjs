#!/usr/bin/env node
/**
 * Pack a self-contained linux-x64 zip for the MeshQL showcase.
 *
 * Output: release/meshql-showcase-linux-x64-<version>.zip
 * Layout: node + server.mjs + public/ + ui/ + uploads/ + run.sh + .env.example
 */
import { createWriteStream, existsSync } from "node:fs";
import {
  chmod,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const monorepoRoot = path.resolve(pkgRoot, "../..");
const releaseRoot = path.join(pkgRoot, "release");
const stagingRoot = path.join(releaseRoot, "staging");

const NODE_VERSION = "22.22.2";
const NODE_PLATFORM = "linux-x64";
const NODE_TARBALL = `node-v${NODE_VERSION}-${NODE_PLATFORM}.tar.gz`;
const NODE_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}`;

const pkg = JSON.parse(
  await readFile(path.join(pkgRoot, "package.json"), "utf8"),
);
const version = pkg.version;
const archiveName = `meshql-showcase-${NODE_PLATFORM}-${version}`;
const zipPath = path.join(releaseRoot, `${archiveName}.zip`);

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      cwd: opts.cwd ?? pkgRoot,
      env: { ...process.env, ...opts.env },
      shell: opts.shell ?? false,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function ensureEsbuild() {
  try {
    return await import("esbuild");
  } catch {
    throw new Error(
      "esbuild is required. Run: pnpm --filter showcase add -D esbuild",
    );
  }
}

async function download(url, dest) {
  console.log(`↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  await pipeline(res.body, createWriteStream(dest));
}

async function extractNodeBinary(tarballPath, destNode) {
  const extractDir = await mkdtemp(path.join(tmpdir(), "meshql-node-"));
  try {
    await run("tar", ["-xzf", tarballPath, "-C", extractDir], {
      cwd: extractDir,
    });
    const extracted = path.join(
      extractDir,
      `node-v${NODE_VERSION}-${NODE_PLATFORM}`,
      "bin",
      "node",
    );
    if (!existsSync(extracted)) {
      throw new Error(`Node binary not found after extract: ${extracted}`);
    }
    await copyFile(extracted, destNode);
    await chmod(destNode, 0o755);
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

async function bundleServer(esbuild) {
  const entry = path.join(pkgRoot, "src", "server.ts");
  const outfile = path.join(stagingRoot, "server.mjs");

  const result = await esbuild.build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    packages: "bundle",
    sourcemap: false,
    logLevel: "info",
    // CJS deps (busboy, etc.) call require("stream"); createRequire makes that work in ESM.
    banner: {
      js: `import { createRequire as __showcaseCreateRequire } from "node:module";
import { fileURLToPath as __showcaseFileURLToPath } from "node:url";
import { dirname as __showcaseDirname } from "node:path";
const require = __showcaseCreateRequire(import.meta.url);
const __filename = __showcaseFileURLToPath(import.meta.url);
const __dirname = __showcaseDirname(__filename);
`,
    },
    // Only Node builtins stay external (incl. node:sqlite)
    plugins: [
      {
        name: "externalize-node-builtins",
        setup(build) {
          build.onResolve({ filter: /^node:/ }, (args) => ({
            path: args.path,
            external: true,
          }));
        },
      },
    ],
  });

  if (result.errors.length) {
    throw new Error("esbuild failed");
  }
  console.log(`✓ bundled ${outfile}`);
}

function runShContents() {
  return `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export NODE_ENV="\${NODE_ENV:-production}"
exec ./node server.mjs
`;
}

function readmeTxtContents() {
  return `MeshQL showcase — standalone linux-x64 release

Quick start
  1. cp .env.example .env
  2. Edit .env (set MESH_SECRET for production)
  3. ./run.sh

Environment
  PORT            HTTP port (default 3010)
  HOST            Bind address (default 0.0.0.0)
  MESH_SECRET     Integrity HMAC secret (required in production)
  SQLITE_FILE     SQLite path (default :memory:). Use a path OUTSIDE this
                  unzip directory if you want data to survive redeploys.
  PUBLIC_ORIGIN   Public URL shown in logs (e.g. https://showcase.meshql.dev)
  SHOWCASE_ASSET_ROOT  Optional override for public/uploads/ui location

Persistence tip
  Point SQLITE_FILE and keep uploads/ (or a symlink) outside the replaceable
  release folder so unzipping a new zip does not wipe the database or avatars.

Health check: GET /health
Login:        GET /login
Docs:         GET /docs
`;
}

async function main() {
  console.log(`Packing showcase ${version} (${NODE_PLATFORM}, Node ${NODE_VERSION})`);

  const esbuild = await ensureEsbuild();

  await rm(stagingRoot, { recursive: true, force: true });
  await mkdir(stagingRoot, { recursive: true });
  await mkdir(path.join(stagingRoot, "uploads"), { recursive: true });
  await mkdir(path.join(stagingRoot, "ui"), { recursive: true });
  await writeFile(path.join(stagingRoot, "uploads", ".gitkeep"), "");

  // 1. Build workspace packages + Vite SPA
  console.log("→ turbo build showcase^...");
  await run("pnpm", ["-w", "exec", "turbo", "run", "build", "--filter=showcase^..."], {
    cwd: monorepoRoot,
  });

  console.log("→ vite build");
  await run("pnpm", ["run", "build:web"], { cwd: pkgRoot });

  // 2. Bundle server
  console.log("→ esbuild server.mjs");
  await bundleServer(esbuild);

  // 3. Copy static assets
  const publicSrc = path.join(pkgRoot, "public");
  const publicDest = path.join(stagingRoot, "public");
  await cp(publicSrc, publicDest, { recursive: true });

  const playgroundSrc = path.join(
    monorepoRoot,
    "packages/docs/ui/playground.html",
  );
  const playgroundDist = path.join(
    monorepoRoot,
    "packages/docs/dist/ui/playground.html",
  );
  const playground =
    existsSync(playgroundDist) ? playgroundDist : playgroundSrc;
  if (!existsSync(playground)) {
    throw new Error(`playground.html not found at ${playground}`);
  }
  await copyFile(playground, path.join(stagingRoot, "ui", "playground.html"));

  await copyFile(
    path.join(pkgRoot, ".env.example"),
    path.join(stagingRoot, ".env.example"),
  );
  await writeFile(path.join(stagingRoot, "run.sh"), runShContents(), {
    mode: 0o755,
  });
  await writeFile(path.join(stagingRoot, "README.txt"), readmeTxtContents());

  // 4. Official Node binary
  const cacheDir = path.join(releaseRoot, ".cache");
  await mkdir(cacheDir, { recursive: true });
  const tarballPath = path.join(cacheDir, NODE_TARBALL);
  if (!existsSync(tarballPath)) {
    await download(NODE_URL, tarballPath);
  } else {
    console.log(`✓ using cached ${NODE_TARBALL}`);
  }
  await extractNodeBinary(tarballPath, path.join(stagingRoot, "node"));

  // 5. Zip with top-level folder
  const bundleDir = path.join(releaseRoot, archiveName);
  await rm(bundleDir, { recursive: true, force: true });
  await rm(zipPath, { force: true });
  await cp(stagingRoot, bundleDir, { recursive: true });

  console.log(`→ zip ${zipPath}`);
  await run("zip", ["-rq", zipPath, archiveName], { cwd: releaseRoot });
  await rm(bundleDir, { recursive: true, force: true });

  console.log(`\nDone: ${zipPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
