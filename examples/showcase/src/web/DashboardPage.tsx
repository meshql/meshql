import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CollectionResult } from "@meshql/core";
import { useMesh } from "./MeshContext.js";
import { NotificationBell } from "./NotificationBell.js";
import {
  describePostUpdate,
  pushNotification,
  type LiveNotification,
} from "./notify.js";
import { PostDetail } from "./PostDetail.js";
import { PostsList } from "./PostsList.js";
import { ProfilePanel } from "./ProfilePanel.js";
import type { PostRow, UserRow } from "./types.js";
import { roleStory } from "./utils.js";

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
  const { auth, wireLog, selectedWireId, query, write, logout, subscribe } = useMesh();
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
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<LiveNotification | null>(null);
  const prevLivePost = useRef<PostRow | null>(null);
  const selectedPostRef = useRef<PostRow | null>(null);
  selectedPostRef.current = selectedPost;

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
      prevLivePost.current = null;
      return;
    }

    setLive(false);
    prevLivePost.current =
      selectedPostRef.current?.id === selectedId ? selectedPostRef.current : null;

    const unsubscribe = subscribe<PostRow>(
      POST_DETAIL_SELECTION,
      {
        entity: "post",
        entityId: String(selectedId),
        onOpen: () => setLive(true),
      },
      (data) => {
        if (!data || typeof data !== "object" || Array.isArray(data)) return;
        if (Object.keys(data).length === 0) return;

        const note = describePostUpdate(prevLivePost.current, data, selectedId);
        prevLivePost.current = data;
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

        if (note) {
          setNotifications((prev) => pushNotification(prev, note));
          setUnread((n) => n + 1);
          setToast(note);
        }
      },
    );

    return unsubscribe;
  }, [auth, selectedId, subscribe]);

  // Seed the SSE diff baseline once the selected post finishes loading.
  useEffect(() => {
    if (selectedId === null || selectedPost?.id !== selectedId) return;
    if (prevLivePost.current?.id === selectedId) return;
    prevLivePost.current = selectedPost;
  }, [selectedId, selectedPost]);

  const dismissToast = useCallback(() => setToast(null), []);

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

  const selectedWire =
    wireLog.find((entry) => entry.id === selectedWireId) ?? wireLog[0];

  return (
    <div className="wrap">
      <header className="dash-header">
        <div>
          <h1>Dashboard</h1>
          <p className="whoami">
            Signed in as <strong>{auth.name}</strong>
            <span className="badge">{auth.role}</span>
          </p>
          <p className="role-strip">{roleStory(auth.role)}</p>
          <p className="demo-note">
            Shared live demo — posts you create are visible to others.{" "}
            <a href="/docs">Playground</a>
            {" · "}
            <a href="https://docs.meshql.dev" target="_blank" rel="noopener noreferrer">
              Docs
            </a>
          </p>
        </div>
        <div className="dash-actions">
          <NotificationBell
            items={notifications}
            unread={unread}
            listening={live && selectedId !== null}
            selectedPostId={selectedId}
            toast={toast}
            onOpen={() => setUnread(0)}
            onClear={() => {
              setNotifications([]);
              setUnread(0);
              setToast(null);
            }}
            onSelectPost={(postId) => {
              void handleSelect(postId);
            }}
            onDismissToast={dismissToast}
          />
          <a className="header-link" href="/docs">
            /docs
          </a>
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
        </div>
      </header>

      {selectedWire ? (
        <p className="action-caption">
          <span className="badge">{selectedWire.method}</span>
          {selectedWire.url}
          {" — "}
          {selectedWire.explain}
        </p>
      ) : (
        <p className="action-caption">
          Interact with the dashboard. Every action is a signed <code>/mesh</code> call
          — open the network sheet below.
        </p>
      )}

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
        </div>
      </div>
    </div>
  );
}
