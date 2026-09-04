import { meshDocsExpressRouter } from "@meshql/docs/express";
import express, { type Express } from "express";
import { meshIntegrityExpressRouter } from "@meshql/integrity/express";
import type { IntegrityConfig } from "@meshql/integrity";
import { mesh } from "./mesh.js";
import { mountUi } from "./ui.js";
import { pubsub } from "./pubsub.js";
import { publicDir, uploadsDir } from "./paths.js";
import { mountSseRoute } from "./sse-handler.js";
import { mountWriteRoute } from "./write-handler.js";

/** Build the showcase Express app (no listen) for server + e2e tests. */
export function createApp(): Express {
  const app = express();
  app.set("trust proxy", 1);

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

  app.use(express.static(publicDir()));
  app.use("/uploads", express.static(uploadsDir()));

  // Interactive UI shells (browser uses @meshql/client → /mesh)
  mountUi(app);

  // Signed REST writes (preview until core mutations)
  mountWriteRoute(app, mesh.integrity, pubsub);

  // Live updates (SSE + pub/sub)
  mountSseRoute(app, "/mesh");

  // Interactive API playground (schema browser + query runner + SQL trace)
  app.use(meshDocsExpressRouter(mesh, mesh.docs, "/docs"));

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
      docs: "/docs",
      api: "/mesh",
    });
  });

  return app;
}
