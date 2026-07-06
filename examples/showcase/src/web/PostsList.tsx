import type { PostRow } from "./types.js";
import { canWritePosts } from "./utils.js";

type PostsListProps = {
  role: string;
  posts: PostRow[];
  selectedId: number | null;
  flash?: string;
  err?: string;
  onSelect: (id: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onCreate: (data: { title: string; body: string; status: string }) => Promise<void>;
};

export function PostsList({
  role,
  posts,
  selectedId,
  flash,
  err,
  onSelect,
  onEdit,
  onDelete,
  onCreate,
}: PostsListProps) {
  const canWrite = canWritePosts(role);

  return (
    <div className="panel" id="posts-panel">
      <h2>
        Posts <span className="badge">GET /mesh/post</span>
      </h2>
      {flash ? <div className="flash">{flash}</div> : null}
      {err ? <div className="flash err">{err}</div> : null}
      {canWrite ? (
        <details className="new-post" open={posts.length === 0}>
          <summary>New post</summary>
          <CreatePostForm onCreate={onCreate} />
        </details>
      ) : (
        <p className="hint">Guests can read published posts only.</p>
      )}
      <div className="post-list">
        {posts.length === 0 ? (
          <p className="hint">No posts visible.</p>
        ) : (
          posts.map((p) => (
            <article
              key={p.id}
              className={`post-row${selectedId === p.id ? " active" : ""}`}
            >
              <button type="button" className="post-card" onClick={() => onSelect(p.id)}>
                <h3>{p.title ?? `Post #${p.id}`}</h3>
                <div className="meta">
                  #{p.id}
                  {p.status ? (
                    <span className={`status ${p.status}`}> {p.status}</span>
                  ) : null}
                  {p.author?.name ? ` · ${p.author.name}` : ""}
                  {p.comments ? ` · ${p.comments.length} comments` : ""}
                </div>
              </button>
              {canWrite ? (
                <div className="row-actions">
                  <button type="button" className="btn small" onClick={() => onEdit(p.id)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => onDelete(p.id)}
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function CreatePostForm({
  onCreate,
}: {
  onCreate: (data: { title: string; body: string; status: string }) => Promise<void>;
}) {
  return (
    <form
      className="crud-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        await onCreate({
          title: String(fd.get("title") ?? ""),
          body: String(fd.get("body") ?? ""),
          status: String(fd.get("status") ?? "draft"),
        });
        e.currentTarget.reset();
      }}
    >
      <label>
        Title
        <input type="text" name="title" required />
      </label>
      <label>
        Body
        <textarea name="body" required rows={4} />
      </label>
      <label>
        Status
        <select name="status" defaultValue="draft">
          <option value="draft">draft</option>
          <option value="published">published</option>
        </select>
      </label>
      <button type="submit" className="btn primary">
        Create post
      </button>
    </form>
  );
}
