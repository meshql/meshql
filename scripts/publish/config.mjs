/** Single source of truth for npm + JSR publish metadata. */

export const NPM_SCOPE = "@meshql-js";
export const JSR_SCOPE = "@meshql";

/** Publish order when multiple packages release together. */
export const PUBLISH_ORDER = [
  "core",
  "postgres",
  "sqlite",
  "prisma",
  "drizzle",
  "kysely",
  "http",
  "upload",
  "client",
  "integrity",
  "access",
  "access-cache",
  "persisted-queries",
  "pubsub",
  "sse",
  "codemods",
  "gateway",
  "docs",
];

/** Packages published by the legacy `all` umbrella tag (tag push). */
export const ALL_TAG_PACKAGES = [
  "core",
  "postgres",
  "sqlite",
  "prisma",
  "drizzle",
  "kysely",
  "http",
  "upload",
  "client",
];

/** Full set used for workflow_dispatch `all`. */
export const ALL_PACKAGES = [...PUBLISH_ORDER];

export const SECURITY_PACKAGES = ["integrity", "access"];

const PACKAGE_SET = new Set(PUBLISH_ORDER);

/**
 * @param {string} packageDir
 * @returns {string} e.g. `@meshql-js/core`
 */
export function npmName(packageDir) {
  if (!PACKAGE_SET.has(packageDir)) {
    throw new Error(`Unknown package directory: ${packageDir}`);
  }
  return `${NPM_SCOPE}/${packageDir}`;
}

/**
 * @param {string} packageDir
 * @returns {string} e.g. `@meshql/core`
 */
export function jsrName(packageDir) {
  if (!PACKAGE_SET.has(packageDir)) {
    throw new Error(`Unknown package directory: ${packageDir}`);
  }
  return `${JSR_SCOPE}/${packageDir}`;
}

/** Longest paths first so @meshql/core/builtins is rewritten before @meshql/core. */
export function importRewrites() {
  const extras = [["@meshql/core/builtins", `${NPM_SCOPE}/core/builtins`]];
  const base = PUBLISH_ORDER.map((dir) => [
    `@meshql/${dir}`,
    npmName(dir),
  ]);
  return [...extras, ...base];
}

/**
 * @param {string} selection
 * @param {{ fullAll?: boolean }} [opts]
 * @returns {string[]}
 */
export function packagesForSelection(selection, opts = {}) {
  const fullAll = opts.fullAll ?? false;

  switch (selection) {
    case "all":
      return fullAll ? [...ALL_PACKAGES] : [...ALL_TAG_PACKAGES];
    case "security":
      return [...SECURITY_PACKAGES];
    default:
      if (!PACKAGE_SET.has(selection)) {
        throw new Error(`Unknown package selection: ${selection}`);
      }
      return [selection];
  }
}

/**
 * Parse a git tag into selection + registry + optional version.
 * @param {string} tag e.g. `npm/core/v1.2.3` or `core/v1.2.3`
 * @returns {{ selection: string, registries: ("npm"|"jsr")[], tagVersion: string }}
 */
export function parseTag(tag) {
  if (tag.startsWith("npm/")) {
    const rest = tag.slice("npm/".length);
    const match = rest.match(/^(.+)\/v(.+)$/);
    if (!match) {
      throw new Error(`Unknown tag format: ${tag} (expected npm/core/v1.2.3)`);
    }
    const [, selection, tagVersion] = match;
    return {
      selection,
      registries: ["npm"],
      tagVersion,
    };
  }

  // Legacy umbrella: v0.8.0
  if (/^v\d/.test(tag)) {
    return {
      selection: "all",
      registries: ["jsr"],
      tagVersion: "",
    };
  }

  const match = tag.match(/^(.+)\/v(.+)$/);
  if (!match) {
    throw new Error(`Unknown tag format: ${tag}`);
  }
  const [, selection, tagVersion] = match;
  // Umbrella tags like all/v* and security/v* may not require version match
  // for multi-package; still pass version when present.
  const skipVersionCheck = selection === "all";
  return {
    selection,
    registries: ["jsr"],
    tagVersion: skipVersionCheck ? "" : tagVersion,
  };
}

export function isKnownPackage(packageDir) {
  return PACKAGE_SET.has(packageDir);
}

export const WORKFLOW_DISPATCH_OPTIONS = [
  "all",
  ...PUBLISH_ORDER,
  "security",
];
