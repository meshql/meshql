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

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      score INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function count(table: string): number {
  return (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
}

export function seed(): void {
  if (count("users") === 0) {
    db.exec(`
      INSERT INTO users (id, name) VALUES (1, 'Ada Lovelace'), (2, 'Grace Hopper');
      INSERT INTO tokens (user_id, access_token, expires_at) VALUES
        (1, 'tok_ada_1', '2026-12-31'),
        (1, 'tok_ada_2', '2027-01-15'),
        (2, 'tok_grace_1', '2026-06-30');
    `);
  }

  if (count("posts") > 0) {
    return;
  }

  // Ada has 7 posts and Grace 3, so "top 5 posts" visibly trims Ada's list.
  const insertPost = db.prepare(
    "INSERT INTO posts (id, user_id, title, score) VALUES (?, ?, ?, ?)",
  );
  const adaTitles = [
    "Notes on the Analytical Engine",
    "Bernoulli numbers, step by step",
    "Poetical science",
    "On the limits of machines",
    "Loops before loops existed",
    "Letters to Babbage",
    "Punched cards for looms",
  ];
  adaTitles.forEach((title, i) => insertPost.run(i + 1, 1, title, 70 - i * 10));
  insertPost.run(8, 2, "Why I wrote a compiler", 65);
  insertPost.run(9, 2, "The first actual bug", 45);
  insertPost.run(10, 2, "Nanoseconds on a string", 25);

  // Each top post gets comments spread over 2026-09-24..28 so that
  // "last 10 comments grouped by day" shows several day buckets.
  const insertComment = db.prepare(
    "INSERT INTO comments (post_id, author_id, body, created_at) VALUES (?, ?, ?, ?)",
  );
  const days = ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27", "2026-09-28"];
  for (const postId of [1, 2, 8]) {
    let n = 0;
    for (const day of days) {
      for (let hour = 9; hour < 12; hour++) {
        n++;
        const authorId = n % 2 === 0 ? 1 : 2;
        const createdAt = `${day}T${String(hour).padStart(2, "0")}:00:00Z`;
        insertComment.run(postId, authorId, `Comment ${n} on post ${postId}`, createdAt);
      }
    }
  }
}

export type SqliteParam = null | number | bigint | string | Uint8Array;
