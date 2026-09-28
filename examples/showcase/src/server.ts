import { createApp } from "./app.js";
import {
  DEFAULT_MESH_SECRET,
  HOST,
  PORT,
  PUBLIC_ORIGIN,
} from "./config.js";
import { SECRET } from "./mesh.js";

const app = createApp();

if (process.env.NODE_ENV === "production" && SECRET === DEFAULT_MESH_SECRET) {
  console.warn(
    "[showcase] MESH_SECRET is still the default. Set MESH_SECRET in production.",
  );
}

app.listen(PORT, HOST, () => {
  console.log(`MeshQL showcase  ${PUBLIC_ORIGIN}`);
  console.log(`  listening  ${HOST}:${PORT}`);
  console.log(`  Login      → ${PUBLIC_ORIGIN}/login`);
  console.log(`  Dashboard  → ${PUBLIC_ORIGIN}/dashboard`);
  console.log(`  Playground → ${PUBLIC_ORIGIN}/docs`);
  console.log(`  API        → ${PUBLIC_ORIGIN}/mesh`);
  console.log(`  Demo       → pnpm --filter showcase demo`);
});
