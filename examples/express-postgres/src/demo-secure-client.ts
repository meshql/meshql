/**
 * Demo client for MeshQL integrity auth flow.
 *
 * Run with: pnpm --filter express-postgres exec tsx src/demo-secure-client.ts
 *
 * Requires server started with MESH_SECRET and integrity routes enabled.
 */
import { createAuthClient } from "@meshql/client";

const baseUrl = process.env.MESH_URL ?? "http://localhost:3001/mesh";

async function main() {
  const client = createAuthClient({ url: baseUrl });

  console.log("Logging in...");
  const tokens = await client.login({
    email: "demo@example.com",
    password: "demo",
  });
  console.log("Auth tokens received, expires at:", new Date(tokens.expiresAt).toISOString());

  console.log("Querying users...");
  const users = await client.query({
    user: { id: true, name: true },
  });
  console.log("Users:", users);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
