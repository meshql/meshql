import { DatabaseSync } from "node:sqlite";

const filename = process.env.SQLITE_FILE ?? ":memory:";

export const db = new DatabaseSync(filename);

export type SqliteParam = null | number | bigint | string | Uint8Array;

export function ensureSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      avatar TEXT,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      author_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      post_id INTEGER NOT NULL REFERENCES posts(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL
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
    INSERT INTO users (id, name, email, role, password) VALUES
      (1, 'Ada Lovelace', 'ada@example.com', 'author', 'demo'),
      (2, 'Grace Hopper', 'grace@example.com', 'author', 'demo'),
      (3, 'Admin User', 'admin@example.com', 'admin', 'demo'),
      (4, 'Guest User', 'guest@example.com', 'guest', 'demo');

    INSERT INTO posts (id, title, body, status, author_id, created_at) VALUES
      (1, 'Notes on the Analytical Engine',
       'The Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves.',
       'published', 1, '2026-01-10T10:00:00Z'),
      (2, 'Draft: On Programming',
       'This draft is only visible to authors and admins.',
       'draft', 1, '2026-02-01T12:00:00Z'),
      (3, 'The Future of Computing',
       'A ship in port is safe, but that is not what ships are for.',
       'published', 2, '2026-03-15T09:30:00Z'),
      (4, 'Bernoulli numbers, step by step',
       'Note G walks the engine through computing Bernoulli numbers, one operation card at a time.',
       'published', 1, '2026-06-02T10:00:00Z'),
      (5, 'Poetical science',
       'Imagination is the discovering faculty, pre-eminently.',
       'published', 1, '2026-08-14T09:00:00Z'),
      (6, 'Draft: Letters to Babbage',
       'Unfinished notes on our correspondence.',
       'draft', 1, '2026-09-20T18:00:00Z'),
      (7, 'Why I wrote a compiler',
       'Nobody believed a computer could write its own programs.',
       'published', 2, '2026-07-01T09:00:00Z'),
      (8, 'The first actual bug',
       'Relay #70, Panel F. First actual case of bug being found.',
       'published', 2, '2026-09-09T15:45:00Z');

    INSERT INTO comments (id, body, post_id, author_id, created_at) VALUES
      (1, 'Brilliant insight.', 1, 2, '2026-01-11T08:00:00Z'),
      (2, 'Still relevant today.', 1, 3, '2026-01-12T14:00:00Z'),
      (3, 'Inspiring as always.', 3, 1, '2026-03-16T11:00:00Z');
  `);

  // Recent comments spread over several days, so "each post's latest 5
  // comments grouped by day" shows more than one day bucket.
  const insertComment = db.prepare(
    "INSERT INTO comments (body, post_id, author_id, created_at) VALUES (?, ?, ?, ?)",
  );
  const bodies = ["Great read.", "Saving this.", "More please!", "Sharing with my team."];
  const days = ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];
  for (const postId of [5, 6, 8]) {
    let n = 0;
    for (const day of days) {
      for (const hour of ["10", "15"]) {
        const authorId = [1, 2, 3][n % 3]!;
        insertComment.run(bodies[n % bodies.length]!, postId, authorId, `${day}T${hour}:00:00Z`);
        n++;
      }
    }
  }
}
