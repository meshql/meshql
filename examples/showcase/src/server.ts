import { createApp } from "./app.js";

const app = createApp();
const port = Number(process.env.PORT ?? 3010);

app.listen(port, () => {
  console.log(`MeshQL showcase  http://localhost:${port}`);
  console.log(`  Login     → http://localhost:${port}/login`);
  console.log(`  Dashboard → http://localhost:${port}/dashboard`);
  console.log(`  Playground → http://localhost:${port}/docs`);
  console.log(`  API       → http://localhost:${port}/mesh`);
  console.log(`  Demo      → pnpm --filter showcase demo`);
});
