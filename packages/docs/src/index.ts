import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { MeshInstance } from "@meshql/core";
import { buildSchemaDoc } from "./introspection.js";
import { executeDocsQuery, type DocsExecuteBody } from "./execute-proxy.js";
import {
  defaultDocsConfig,
  isDocsAuthAllowed,
  normalizeDocsPath,
  warnIfOpenDocsInProduction,
  type DocsConfig,
} from "./options.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let cachedPlaygroundHtml: string | undefined;

function playgroundHtmlPath(): string {
  const built = join(__dirname, "ui", "playground.html");
  if (existsSync(built)) {
    return built;
  }
  return join(__dirname, "..", "ui", "playground.html");
}

function loadPlaygroundHtml(theme: "dark" | "light", title: string): string {
  const base = cachedPlaygroundHtml ?? readFileSync(
    playgroundHtmlPath(),
    "utf8",
  );
  cachedPlaygroundHtml = base;
  return base
    .replaceAll("{{TITLE}}", escapeHtml(title))
    .replaceAll("{{THEME}}", theme);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export interface DocsHttpRequest {
  method: string;
  path?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

function relativeDocsPath(basePath: string, requestPath: string): string | undefined {
  const normalizedBase = normalizeDocsPath(basePath);
  const path = requestPath.split("?")[0] ?? "";
  if (path === normalizedBase || path.startsWith(`${normalizedBase}/`)) {
    const relative = path.slice(normalizedBase.length);
    return relative === "" ? "/" : relative;
  }
  return undefined;
}

function contextFromRequest(
  req: DocsHttpRequest,
): { requestId: string; method: "GET" } & Record<string, unknown> {
  const role = headerValue(req.headers, "x-mesh-role");
  const userId = headerValue(req.headers, "x-mesh-user-id");
  return {
    requestId: crypto.randomUUID(),
    method: "GET",
    ...(role ? { role } : {}),
    ...(userId ? { userId } : {}),
  };
}

function headerValue(
  headers: DocsHttpRequest["headers"],
  name: string,
): string | undefined {
  const raw = headers?.[name] ?? headers?.[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

/** HTTP handler for MeshQL docs routes only. */
export function createDocsHandler(
  mesh: MeshInstance,
  config: DocsConfig = {},
): (req: DocsHttpRequest) => Promise<{ status: number; body: unknown; headers?: Record<string, string> }> {
  const resolved = defaultDocsConfig(config);
  warnIfOpenDocsInProduction(resolved.auth, resolved.path);

  return async function docsHandler(req) {
    const method = req.method.toUpperCase();
    const requestPath = req.path ?? "";
    const relative = relativeDocsPath(resolved.path, requestPath);

    if (relative === undefined) {
      return { status: 404, body: { error: "NotFound" } };
    }

    if (relative === "/" && method === "GET") {
      const html = loadPlaygroundHtml(
        resolved.theme ?? "dark",
        resolved.title ?? "MeshQL API",
      );
      return {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: html,
      };
    }

    const ctx = contextFromRequest(req);

    if (!isDocsAuthAllowed(resolved.auth, ctx)) {
      return {
        status: 403,
        body: { error: "Forbidden", message: "Docs access denied" },
      };
    }

    if (relative === "/schema" && method === "GET") {
      const doc = buildSchemaDoc(mesh.schema, {
        title: resolved.title,
        entities: resolved.entities,
      });
      return { status: 200, body: doc };
    }

    if (relative === "/execute" && method === "POST") {
      const body = (req.body ?? {}) as DocsExecuteBody;
      return executeDocsQuery(mesh, resolved, body);
    }

    return { status: 404, body: { error: "NotFound" } };
  };
}

/** Attach docs config to a mesh instance (like `withUpload`). */
export function withDocs(
  mesh: MeshInstance,
  config: DocsConfig = {},
): MeshInstance & { docs: DocsConfig } {
  const resolved = defaultDocsConfig(config);
  warnIfOpenDocsInProduction(resolved.auth, resolved.path);
  return Object.assign(mesh, { docs: resolved });
}

export type { DocsConfig, DocsAuth } from "./options.js";
export { buildSchemaDoc } from "./introspection.js";
export type {
  SchemaDoc,
  SchemaEntityDoc,
  SchemaFieldDoc,
  SchemaJoinDoc,
  SchemaQueryCapabilities,
} from "./introspection.js";
