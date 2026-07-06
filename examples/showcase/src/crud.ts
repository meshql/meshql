import { db } from "./db.js";
import type { AuthContext } from "./auth-context.js";

export class CrudError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrudError";
  }
}

function assertRole(session: AuthContext, ...roles: string[]): void {
  if (!roles.includes(session.role)) {
    throw new CrudError(`Requires role: ${roles.join(" or ")}`);
  }
}

function postAuthorId(postId: number): number | undefined {
  const row = db
    .prepare("SELECT author_id FROM posts WHERE id = ?")
    .get(postId) as { author_id: number } | undefined;
  return row?.author_id;
}

function canManagePost(session: AuthContext, postId: number): boolean {
  if (session.role === "admin") return true;
  if (session.role !== "author") return false;
  return postAuthorId(postId) === Number(session.userId);
}

export function createPost(
  session: AuthContext,
  input: { title: string; body: string; status: string },
): { id: number } {
  assertRole(session, "author", "admin");
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new CrudError("Title and body are required");
  if (!["draft", "published"].includes(input.status)) {
    throw new CrudError("Status must be draft or published");
  }

  const result = db
    .prepare(
      "INSERT INTO posts (title, body, status, author_id, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(title, body, input.status, Number(session.userId), new Date().toISOString());

  return { id: Number(result.lastInsertRowid) };
}

export function updatePost(
  session: AuthContext,
  postId: number,
  input: { title: string; body: string; status: string },
): void {
  if (!canManagePost(session, postId)) {
    throw new CrudError("You cannot edit this post");
  }

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) throw new CrudError("Title and body are required");
  if (!["draft", "published"].includes(input.status)) {
    throw new CrudError("Status must be draft or published");
  }

  const result = db
    .prepare("UPDATE posts SET title = ?, body = ?, status = ? WHERE id = ?")
    .run(title, body, input.status, postId);

  if (result.changes === 0) throw new CrudError("Post not found");
}

export function deletePost(session: AuthContext, postId: number): void {
  if (!canManagePost(session, postId)) {
    throw new CrudError("You cannot delete this post");
  }

  db.prepare("DELETE FROM comments WHERE post_id = ?").run(postId);
  const result = db.prepare("DELETE FROM posts WHERE id = ?").run(postId);
  if (result.changes === 0) throw new CrudError("Post not found");
}

export function createComment(
  session: AuthContext,
  postId: number,
  body: string,
): { id: number } {
  assertRole(session, "author", "admin");
  const text = body.trim();
  if (!text) throw new CrudError("Comment body is required");

  const post = db
    .prepare("SELECT id, status FROM posts WHERE id = ?")
    .get(postId) as { id: number; status: string } | undefined;
  if (!post) throw new CrudError("Post not found");
  if (session.role === "author" && post.status === "draft") {
    const authorId = postAuthorId(postId);
    if (authorId !== Number(session.userId)) {
      throw new CrudError("You cannot comment on this draft");
    }
  }

  const result = db
    .prepare(
      "INSERT INTO comments (body, post_id, author_id, created_at) VALUES (?, ?, ?, ?)",
    )
    .run(text, postId, Number(session.userId), new Date().toISOString());

  return { id: Number(result.lastInsertRowid) };
}

export function deleteComment(session: AuthContext, commentId: number): void {
  const row = db
    .prepare("SELECT author_id FROM comments WHERE id = ?")
    .get(commentId) as { author_id: number } | undefined;
  if (!row) throw new CrudError("Comment not found");

  const allowed =
    session.role === "admin" || row.author_id === Number(session.userId);
  if (!allowed) throw new CrudError("You cannot delete this comment");

  db.prepare("DELETE FROM comments WHERE id = ?").run(commentId);
}

export function canWritePosts(session: AuthContext): boolean {
  return session.role === "author" || session.role === "admin";
}

export function canWriteComments(session: AuthContext): boolean {
  return session.role === "author" || session.role === "admin";
}
