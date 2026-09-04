import type { Express } from "express";
import path from "node:path";
import { publicDir } from "./paths.js";

const indexHtml = path.join(publicDir(), "index.html");

/** SPA fallback — React app handles /login and /dashboard client-side. */
export function mountUi(app: Express): void {
  app.get(["/", "/login", "/dashboard"], (_req, res) => {
    res.sendFile(indexHtml);
  });
}
