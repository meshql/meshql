import type { QueryContext } from "@meshql/core";

/** Who may access docs routes (`/docs/schema`, `/docs/execute`). */
export type DocsAuth = false | "admin" | ((ctx: QueryContext) => boolean);

export interface DocsConfig {
  /** URL prefix for docs routes. Default `/docs`. */
  path?: string;
  title?: string;
  theme?: "dark" | "light";
  /**
   * Access control for schema + execute routes.
   * `false` allows all requests (warns in production).
   */
  auth?: DocsAuth;
  /**
   * SQL trace in execute responses. `"dev"` enables tracing; `false` disables.
   * Default: `"dev"` when `NODE_ENV !== "production"`, else `false`.
   */
  sql?: false | "dev";
  /** Allowlist of entity names to expose. */
  entities?: string[];
}

export function defaultDocsConfig(config: DocsConfig = {}): Required<
  Pick<DocsConfig, "path" | "theme" | "auth" | "sql">
> &
  DocsConfig {
  const inProd = process.env.NODE_ENV === "production";
  return {
    path: "/docs",
    theme: "dark",
    auth: false,
    sql: inProd ? false : "dev",
    ...config,
  };
}

export function normalizeDocsPath(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path.replace(/\/+$/, "") || "/docs";
}

export function isDocsAuthAllowed(
  auth: DocsAuth,
  ctx: QueryContext,
): boolean {
  if (auth === false) {
    return true;
  }
  if (auth === "admin") {
    return ctx.role === "admin";
  }
  return auth(ctx);
}

export function warnIfOpenDocsInProduction(auth: DocsAuth, path: string): void {
  if (auth === false && process.env.NODE_ENV === "production") {
    console.warn(
      `[meshql/docs] ${path} is open without auth in production. Set auth: "admin" or a custom guard.`,
    );
  }
}

export function shouldTraceSql(config: DocsConfig): boolean {
  const sql = config.sql ?? (process.env.NODE_ENV === "production" ? false : "dev");
  return sql === "dev";
}
