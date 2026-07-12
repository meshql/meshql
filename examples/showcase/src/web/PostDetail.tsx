import { FormEvent } from "react";
import type { PostRow } from "./types.js";
import { canWriteComments } from "./utils.js";
import { PostForm } from "./PostForm.js";

type PostDetailProps = {
  role: string;
  post: PostRow | null;
  editing: boolean;
  live?: boolean;
  flash?: string;
  err?: string;
  onCancelEdit: () => void;
  onUpdate: (data: { title: string; body: string; status: string }) => Promise<void>;
  onAddComment: (body: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
};

export function PostDetail({
  role,
  post,
  editing,
  live,
  flash,
  err,
  onCancelEdit,
  onUpdate,
  onAddComment,
  onDeleteComment,
}: PostDetailProps) {
  if (!post) {
    return (
      <div className="panel detail-panel empty" id="post-detail">
        <p className="hint">Select a post to view details.</p>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="panel detail-panel" id="post-detail">
        <h2>Edit post</h2>
        <PostForm
          title={post.title}
          body={post.body}
          status={post.status}
          submitLabel="Save"
          onSubmit={onUpdate}
          onCancel={onCancelEdit}
        />
      </div>
    );
  }

  const comments = post.comments ?? [];
  const canComment = canWriteComments(role);

  return (
    <div className="panel detail-panel" id="post-detail">
      <h2>
        {post.title ?? `Post #${post.id}`}
        {live ? <span className="badge live">live</span> : null}
      </h2>
      {flash ? <div className="flash">{flash}</div> : null}
      {err ? <div className="flash err">{err}</div> : null}
      {post.status ? <span className={`status ${post.status}`}>{post.status}</span> : null}
      {post.author?.name ? <span className="meta"> by {post.author.name}</span> : null}
      {post.body ? <p className="body">{post.body}</p> : null}

      <h3 style={{ marginTop: "1.25rem" }}>Comments</h3>
      {comments.length === 0 ? (
        <p className="hint">No comments yet.</p>
      ) : (
        <ul className="comments">
          {comments.map((c) => (
            <li key={c.id}>
              <span>{c.body}</span>
              {c.author?.name ? <span className="meta"> — {c.author.name}</span> : null}
              {canComment && c.id ? (
                <button
                  type="button"
                  className="btn small danger inline"
                  onClick={() => onDeleteComment(c.id!)}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canComment ? <CommentForm onSubmit={onAddComment} /> : null}
    </div>
  );
}

function CommentForm({ onSubmit }: { onSubmit: (body: string) => Promise<void> }) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = String(new FormData(event.currentTarget).get("body") ?? "");
    await onSubmit(body);
    event.currentTarget.reset();
  }

  return (
    <form className="crud-form compact" onSubmit={handleSubmit}>
      <label>
        Add comment
        <textarea name="body" required rows={2} placeholder="Write a comment…" />
      </label>
      <button type="submit" className="btn primary">
        Post comment
      </button>
    </form>
  );
}
