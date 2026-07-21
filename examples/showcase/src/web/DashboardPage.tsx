import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CollectionResult } from "@meshql/core";
import { useMesh } from "./MeshContext.js";
import { PostDetail } from "./PostDetail.js";
import { PostsList } from "./PostsList.js";
import { ProfilePanel } from "./ProfilePanel.js";
import { WirePanel } from "./WirePanel.js";
import type { PostRow, UserRow } from "./types.js";

const POST_DETAIL_SELECTION = {
  post: {
    $select: {
      id: true,
      title: true,
      body: true,
      status: true,
      author: { $select: { name: true } },
      comments: {
        $select: {
          id: true,
          body: true,
          author: { $select: { name: true } },
        },
      },
    },
  },
} as const;

export function DashboardPage() {
  const { auth, wireLog, query, write, logout, subscribe } = useMesh();
  const navigate = useNavigate();

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [user, setUser] = useState<UserRow | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState<string>();
  const [err, setErr] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const loadPosts = useCallback(async () => {
    const data = await query<CollectionResult<PostRow>>(
      {
        post: {
          $select: {
            id: true,
            title: true,
            status: true,
            author: { $select: { name: true } },
            comments: { $select: { id: true, body: true } },
          },
          $page: { first: 50 },
          $orderBy: [{ field: "createdAt", direction: "desc" }],
        },
      },
    );
    return data.items ?? [];
  }, [query]);

  const loadPost = useCallback(
    async (id: number) => {
      try {
        const data = await query<PostRow>(POST_DETAIL_SELECTION, {
          entityId: String(id),
        });
        if (!data || typeof data !== "object" || Array.isArray(data)) return null;
        if (Object.keys(data).length === 0) return null;
        return data;
      } catch {
        return null;
      }
    },
    [query],
  );

  const loadProfile = useCallback(async () => {
    if (!auth?.userId) return null;
    try {
      return await query<UserRow>(
        {
          user: {
            $select: {
              id: true,
              name: true,
              email: true,
              role: true,
              avatar: true,
            },
          },
        },
        { entityId: auth.userId },
      );
    } catch {
      return null;
    }
  }, [auth?.userId, query]);

  const refresh = useCallback(async () => {
    const [nextPosts, nextUser] = await Promise.all([loadPosts(), loadProfile()]);
    setPosts(nextPosts);
    setUser(nextUser);
    if (selectedId !== null) {
      setSelectedPost(await loadPost(selectedId));
    }
  }, [loadPosts, loadProfile, loadPost, selectedId]);

  useEffect(() => {
    if (!auth) {
      navigate("/login");
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const [nextPosts, nextUser] = await Promise.all([loadPosts(), loadProfile()]);
        if (!cancelled) {
          setPosts(nextPosts);
          setUser(nextUser);
        }
      } catch (error) {
        if (!cancelled) {
          setErr(error instanceof Error ? error.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [auth, navigate, loadPosts, loadProfile]);

  useEffect(() => {
    if (!auth || selectedId === null) {
      setLive(false);
      return;
    }

    setLive(false);
    const unsubscribe = subscribe<PostRow>(
      POST_DETAIL_SELECTION,
      { entity: "post", entityId: String(selectedId) },
      (data) => {
        if (!data || typeof data !== "object" || Array.isArray(data)) return;
        if (Object.keys(data).length === 0) return;
        setSelectedPost(data);
        setLive(true);
        setPosts((prev) =>
          prev.map((post) =>
            post.id === selectedId
              ? {
                  ...post,
                  title: data.title ?? post.title,
                  status: data.status ?? post.status,
                  comments: data.comments ?? post.comments,
                }
              : post,
          ),
        );
      },
    );

    return unsubscribe;
  }, [auth, selectedId, subscribe]);

  async function withFlash(action: () => Promise<void>, success: string) {
    setFlash(undefined);
    setErr(undefined);
    try {
      await action();
      setFlash(success);
      await refresh();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Request failed");
    }
  }

  async function handleSelect(id: number) {
    setSelectedId(id);
    setEditing(false);
    setSelectedPost(await loadPost(id));
  }

  if (!auth) return null;

  return (
    <div className="wrap">
      <header className="dash-header">
        <div>
          <h1>Dashboard</h1>
          <p className="whoami">
            Signed in as <strong>{auth.name}</strong>
            <span className="badge">{auth.role}</span>
          </p>
        </div>
        <button
          type="button"
          className="btn"
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
        >
          Sign out
        </button>
      </header>

      {loading ? <p className="hint">Loading…</p> : null}
      {flash ? <div className="flash">{flash}</div> : null}
      {err ? <div className="flash err">{err}</div> : null}

      <div className="grid dash-grid">
        <div className="stack">
          <PostsList
            role={auth.role}
            posts={posts}
            selectedId={selectedId}
            onSelect={handleSelect}
            onEdit={async (id) => {
              setSelectedId(id);
              setEditing(true);
              setSelectedPost(await loadPost(id));
            }}
            onDelete={async (id) => {
              if (!confirm("Delete this post and its comments?")) return;
              await withFlash(async () => {
                await write("delete", "post", { id });
                if (selectedId === id) {
                  setSelectedId(null);
                  setSelectedPost(null);
                }
              }, "Post deleted");
            }}
            onCreate={async (data) => {
              await withFlash(async () => {
                const result = (await write("create", "post", { data })) as { id?: number };
                if (result.id) {
                  setSelectedId(result.id);
                  setSelectedPost(await loadPost(result.id));
                }
              }, `Created post`);
            }}
          />
        </div>
        <div className="stack">
          <PostDetail
            role={auth.role}
            post={selectedPost}
            editing={editing}
            live={live}
            onCancelEdit={() => setEditing(false)}
            onUpdate={async (data) => {
              if (selectedId === null) return;
              await withFlash(async () => {
                await write("update", "post", { id: selectedId, data });
                setEditing(false);
              }, "Post updated");
            }}
            onAddComment={async (body) => {
              if (selectedId === null) return;
              await withFlash(async () => {
                await write("create", "comment", {
                  data: { postId: selectedId, body },
                });
              }, "Comment added");
            }}
            onDeleteComment={async (commentId) => {
              if (!confirm("Delete this comment?")) return;
              await withFlash(async () => {
                await write("delete", "comment", { id: commentId });
              }, "Comment deleted");
            }}
          />
          <ProfilePanel
            user={user}
            onUploaded={async () => setUser(await loadProfile())}
          />
          <WirePanel entries={wireLog} />
        </div>
      </div>
    </div>
  );
}
