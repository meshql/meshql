import { useEffect, useRef, useState } from "react";
import type { LiveNotification } from "./notify.js";
import { formatNotifyTime } from "./notify.js";

type NotificationBellProps = {
  items: LiveNotification[];
  unread: number;
  listening: boolean;
  selectedPostId: number | null;
  toast: LiveNotification | null;
  onOpen: () => void;
  onClear: () => void;
  onSelectPost: (postId: number) => void;
  onDismissToast: () => void;
};

export function NotificationBell({
  items,
  unread,
  listening,
  selectedPostId,
  toast,
  onOpen,
  onClear,
  onSelectPost,
  onDismissToast,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismissToast, 4200);
    return () => window.clearTimeout(timer);
  }, [toast, onDismissToast]);

  return (
    <>
      <div className="notify-root" ref={rootRef}>
        <button
          type="button"
          className={`notify-bell${open ? " open" : ""}${listening ? " listening" : ""}`}
          aria-expanded={open}
          aria-label={
            unread > 0
              ? `Live activity, ${unread} unread`
              : listening
                ? "Live activity, listening"
                : "Live activity"
          }
          title="Live activity from SSE"
          onClick={() => {
            setOpen((value) => !value);
            onOpen();
          }}
        >
          <span className="notify-bell-icon" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5a3.5 3.5 0 0 0-3.5 3.5v1.6c0 .7-.2 1.4-.6 2L3.2 9.8c-.3.4 0 1 .5 1h8.6c.5 0 .8-.6.5-1l-.7-1.2c-.4-.6-.6-1.3-.6-2V5A3.5 3.5 0 0 0 8 1.5Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
              <path
                d="M6.4 12.2a1.8 1.8 0 0 0 3.2 0"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          {unread > 0 ? <span className="notify-badge">{unread > 9 ? "9+" : unread}</span> : null}
          {listening && unread === 0 ? <span className="notify-live-pip" /> : null}
        </button>

        {open ? (
          <div className="notify-panel" role="dialog" aria-label="Live activity">
            <div className="notify-panel-head">
              <div>
                <strong>Live activity</strong>
                <p className="hint">
                  {listening && selectedPostId !== null
                    ? `SSE open on post ${selectedPostId}`
                    : "Select a post to subscribe over SSE"}
                </p>
              </div>
              <button
                type="button"
                className="btn small"
                onClick={onClear}
                disabled={items.length === 0}
              >
                Clear
              </button>
            </div>

            {items.length === 0 ? (
              <p className="hint notify-empty">
                Open a post, then edit or comment (another tab works too). Updates arrive on{" "}
                <code>GET /mesh/post/:id/events</code>.
              </p>
            ) : (
              <ul className="notify-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`notify-item kind-${item.kind}`}
                      onClick={() => {
                        onSelectPost(item.postId);
                        setOpen(false);
                      }}
                    >
                      <span className="notify-item-title">{item.title}</span>
                      <span className="notify-item-detail">{item.detail}</span>
                      <span className="notify-item-meta">
                        <span className="badge">SSE</span>
                        {formatNotifyTime(item.at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {toast ? (
        <div className="notify-toast" role="status">
          <div className="notify-toast-body">
            <strong>{toast.title}</strong>
            <span>{toast.detail}</span>
          </div>
          <button
            type="button"
            className="notify-toast-close"
            aria-label="Dismiss"
            onClick={onDismissToast}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
