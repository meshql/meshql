import { pool, ensureSchema } from "./db.js";
import { inMemoryRows } from "./data.js";

async function main() {
  if (!pool) {
    console.log("Set DATABASE_URL to seed Postgres. In-memory mode needs no seed.");
    return;
  }

  await ensureSchema();
  await pool.query("TRUNCATE tokens, users RESTART IDENTITY CASCADE");

  const users = await pool.query(
    `INSERT INTO users (name) VALUES ($1), ($2) RETURNING id, name`,
    ["Ada Lovelace", "Grace Hopper"],
  );

  const ada = users.rows[0]!;
  const grace = users.rows[1]!;

  await pool.query(
    `INSERT INTO tokens (user_id, access_token, expires_at) VALUES
      ($1, $2, $3),
      ($1, $4, $5),
      ($6, $7, $8)`,
    [
      ada.id,
      "tok_ada_1",
      "2026-12-31",
      "tok_ada_2",
      "2027-01-15",
      grace.id,
      "tok_grace_1",
      "2026-06-30",
    ],
  );

  console.log("Seeded users and tokens.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
