import { DatabaseSync } from "node:sqlite";

const filename = process.env.SQLITE_FILE ?? ":memory:";

export const db = new DatabaseSync(filename);

export function ensureSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      access_token TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
  `);
}

export function seed(): void {
  const userCount = db.prepare("SELECT count(*) AS n FROM users").get() as {
    n: number;
  };
  if (userCount.n > 0) {
    return;
  }

  db.exec(`
    INSERT INTO users (id, name) VALUES (1, 'Ada Lovelace'), (2, 'Grace Hopper');
    INSERT INTO tokens (user_id, access_token, expires_at) VALUES
      (1, 'tok_ada_1', '2026-12-31'),
      (1, 'tok_ada_2', '2027-01-15'),
      (2, 'tok_grace_1', '2026-06-30');
  `);
}

export type SqliteParam = null | number | bigint | string | Uint8Array;
