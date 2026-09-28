import type { MeshQuery } from "@meshql/client";
import type { AuthorActivity, CommentDay } from "./types.js";

export const LATEST_POSTS = 3;
export const LATEST_COMMENTS = 5;

/**
 * Every author, their latest posts, and each post's latest comments grouped
 * by day. `$orderBy` / `$page` / `$groupBy` on `posts` and `comments` apply
 * per parent row, and the server runs it as one SQL statement.
 */
export const AUTHORS_QUERY = {
  user: {
    $select: {
      id: true,
      name: true,
      posts: {
        $select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          comments: {
            $select: { id: true, body: true, author: { $select: { name: true } } },
            $orderBy: [{ field: "createdAt", direction: "desc" }],
            $page: { first: LATEST_COMMENTS },
            $groupBy: [{ field: "createdAt", bucket: "day", as: "date" }],
            $aggregate: { count: { fn: "count", field: "*" } },
          },
        },
        $orderBy: [{ field: "createdAt", direction: "desc" }],
        $page: { first: LATEST_POSTS },
      },
    },
    $where: { field: "role", op: "eq", value: "author" },
    $orderBy: [{ field: "id", direction: "asc" }],
    $page: { first: 10 },
  },
} satisfies MeshQuery;

type AuthorsPanelProps = {
  authors: AuthorActivity[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function AuthorsPanel({ authors, selectedId, onSelect }: AuthorsPanelProps) {
  return (
    <div className="panel" id="authors-panel">
      <h2>
        Authors <span className="badge">GET /mesh/user</span>
      </h2>
      <p className="hint authors-lede">
        Every author, their {LATEST_POSTS} latest posts, and each post&apos;s{" "}
        {LATEST_COMMENTS} latest comments grouped by day — one query, one SQL statement.
        Open its <strong>SQL</strong> tab in the network sheet.
      </p>
      {authors.length === 0 ? (
        <p className="hint">No authors visible.</p>
      ) : (
        <div className="authors">
          {authors.map((author) => (
            <section key={author.id} className="author">
              <h3>{author.name ?? `User #${author.id}`}</h3>
              {(author.posts ?? []).length === 0 ? (
                <p className="hint">No posts visible.</p>
              ) : (
                <ul className="author-posts">
                  {(author.posts ?? []).map((post) => (
                    <li key={post.id}>
                      <button
                        type="button"
                        className={`author-post${selectedId === post.id ? " active" : ""}`}
                        onClick={() => onSelect(post.id)}
                      >
                        <span className="author-post-title">
                          {post.title ?? `Post #${post.id}`}
                        </span>
                        {post.status ? (
                          <span className={`status ${post.status}`}>{post.status}</span>
                        ) : null}
                      </button>
                      <CommentDays days={post.comments ?? []} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentDays({ days }: { days: CommentDay[] }) {
  if (days.length === 0) {
    return <p className="meta comment-days-empty">no comments</p>;
  }
  return (
    <ul className="comment-days">
      {days.map((day) => (
        <li key={day.date}>
          <span className="comment-day-date">{day.date}</span>
          <span className="comment-day-count">
            {day.count} comment{day.count === 1 ? "" : "s"}
          </span>
          <span className="comment-day-who">
            {day.items
              .map((comment) => comment.author?.name)
              .filter(Boolean)
              .join(", ")}
          </span>
        </li>
      ))}
    </ul>
  );
}
