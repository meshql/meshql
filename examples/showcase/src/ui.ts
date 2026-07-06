import type { Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHtml = path.join(__dirname, "../public/index.html");

/** SPA fallback — React app handles /login and /dashboard client-side. */
export function mountUi(app: Express): void {
  app.get(["/", "/login", "/dashboard"], (_req, res) => {
    res.sendFile(indexHtml);
  });
}
