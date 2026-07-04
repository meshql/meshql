import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { meshIntegrityExpressRouter } from "@meshql/integrity/express";
import type { IntegrityConfig } from "@meshql/integrity";
import { mesh } from "./mesh.js";
import { mountUi } from "./ui.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// JSON / form bodies for UI routes; leave multipart streams untouched.
app.use((req, res, next) => {
  const type = req.headers["content-type"] ?? "";
  if (type.includes("multipart/form-data")) {
    next();
    return;
  }
  express.json()(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true })(req, res, next);
  });
});

app.use(express.static(path.join(__dirname, "../public")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Interactive HTMX UI
mountUi(app);

// MeshQL API (signed header transport)
app.use(
  meshIntegrityExpressRouter(
    mesh,
    mesh.integrity as IntegrityConfig,
    "/mesh",
  ),
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: "meshql-showcase",
    storage: process.env.SQLITE_FILE ?? "sqlite::memory:",
    security: "integrity",
    ui: "/",
    api: "/mesh",
  });
});

const port = Number(process.env.PORT ?? 3010);

app.listen(port, () => {
  console.log(`MeshQL showcase  http://localhost:${port}`);
  console.log(`  UI   → http://localhost:${port}/`);
  console.log(`  API  → http://localhost:${port}/mesh`);
  console.log(`  Demo → pnpm --filter showcase demo`);
});
