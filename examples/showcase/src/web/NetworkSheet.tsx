import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useMesh } from "./MeshContext.js";
import type { WireEntry } from "./types.js";
import {
  displayPath,
  formatDuration,
  formatStatus,
  lastCallLabel,
} from "./wire.js";

type Filter = "all" | "GET" | "POST" | "PATCH" | "DELETE" | "SSE";
type Tab = "query" | "response" | "explain";

const COLLAPSED = 41;
const MIN_HEIGHT = 160;

export function NetworkSheet() {
  const { wireLog, selectedWireId, selectWire, clearWireLog } = useMesh();
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 320 : Math.round(window.innerHeight * 0.42),
  );
  const [tab, setTab] = useState<Tab>("query");
  const [filter, setFilter] = useState<Filter>("all");
  const [flashId, setFlashId] = useState<string | null>(null);

  const newestId = wireLog[0]?.id;
  const live = wireLog.some((entry) => entry.kind === "sse" && entry.live);

  useEffect(() => {
    if (!newestId) return;
    setFlashId(newestId);
    const timer = window.setTimeout(() => setFlashId(null), 900);
    return () => window.clearTimeout(timer);
  }, [newestId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const pad = expanded ? height : COLLAPSED;
    document.documentElement.style.setProperty("--network-sheet-pad", `${pad}px`);
    return () => {
      document.documentElement.style.removeProperty("--network-sheet-pad");
    };
  }, [expanded, height]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? wireLog
        : wireLog.filter((entry) => entry.method === filter),
    [filter, wireLog],
  );

  const selected = selectedWireId
    ? (wireLog.find((entry) => entry.id === selectedWireId) ?? null)
    : null;

  useEffect(() => {
    if (!selected) return;
    setTab(selected.kind === "sse" ? "response" : "query");
  }, [selected?.id]);

  function onResizeStart(event: ReactMouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const startH = expanded ? height : Math.round(window.innerHeight * 0.42);
    setExpanded(true);
    setHeight(startH);

    function move(ev: MouseEvent) {
      const next = startH + (startY - ev.clientY);
      const max = Math.round(window.innerHeight * 0.8);
      setHeight(Math.min(Math.max(next, MIN_HEIGHT), max));
    }
    function up() {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    }
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  return (
    <div
      className={`network-sheet${expanded ? " is-open" : ""}`}
      style={expanded ? { height } : undefined}
    >
      <div
        className="network-resize"
        onMouseDown={onResizeStart}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize network sheet"
      />
      <button
        type="button"
        className="network-bar"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="network-chevron" aria-hidden>
          {expanded ? "▾" : "▴"}
        </span>
        <strong>MeshQL network</strong>
        <span className="network-last">{lastCallLabel(wireLog[0])}</span>
        <span className="network-count">{wireLog.length}</span>
        {live ? <span className="network-live">live</span> : null}
      </button>

      {expanded ? (
        <div className="network-body">
          <div className="network-toolbar">
            <div className="network-filters" role="tablist" aria-label="Filter by method">
              {(["all", "GET", "POST", "PATCH", "DELETE", "SSE"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`network-filter${filter === item ? " active" : ""}`}
                  onClick={() => setFilter(item)}
                >
                  {item === "all" ? "All" : item}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn small"
              onClick={() => clearWireLog()}
              disabled={wireLog.length === 0}
            >
              Clear
            </button>
          </div>

          <div className="network-split">
            <div className="network-table-wrap">
              {filtered.length === 0 ? (
                <p className="hint network-empty">
                  Interact with the app to stream signed <code>/mesh/*</code> calls here.
                </p>
              ) : (
                <div className="network-table" role="table">
                  <div className="network-row head" role="row">
                    <span>Method</span>
                    <span>Path</span>
                    <span>Type</span>
                    <span>Status</span>
                    <span>Time</span>
                  </div>
                  {filtered.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      role="row"
                      className={`network-row ${methodClass(entry)}${
                        selected?.id === entry.id ? " selected" : ""
                      }${flashId === entry.id ? " flash" : ""}`}
                      onClick={() => selectWire(entry.id)}
                    >
                      <span className="network-method">
                        {entry.kind === "sse" ? "GET" : entry.method}
                      </span>
                      <span className="network-path" title={entry.url}>
                        {displayPath(entry.url)}
                        {entry.kind === "sse" && entry.live ? (
                          <span className="network-live-dot" />
                        ) : null}
                      </span>
                      <span className="network-kind">{typeLabel(entry)}</span>
                      <span className={`network-status${entry.error ? " is-error" : ""}`}>
                        {formatStatus(entry.status)}
                        {entry.kind === "sse" && (entry.eventCount ?? 0) > 0
                          ? ` · ${entry.eventCount}`
                          : ""}
                      </span>
                      <span className="network-time">
                        {entry.status === "pending"
                          ? "…"
                          : entry.kind === "sse" && entry.live
                            ? "stream"
                            : formatDuration(entry.durationMs)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="network-inspector">
              {selected ? (
                <>
                  <div className="network-tabs">
                    {(["query", "response", "explain"] as const).map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`network-tab${tab === item ? " active" : ""}`}
                        onClick={() => setTab(item)}
                      >
                        {tabLabel(item, selected.kind)}
                      </button>
                    ))}
                  </div>
                  <InspectorTab tab={tab} entry={selected} />
                </>
              ) : (
                <p className="hint network-empty">
                  Select a request in the list to inspect headers and response.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InspectorTab({ tab, entry }: { tab: Tab; entry: WireEntry }) {
  if (tab === "explain") {
    return (
      <div className="network-explain">
        <p>{entry.explain}</p>
        {entry.kind === "sse" ? (
          <p className="hint">
            {entry.live ? "Connection open." : "Connection closed."}{" "}
            {entry.eventCount ?? 0} event{(entry.eventCount ?? 0) === 1 ? "" : "s"} in the
            response stream.
          </p>
        ) : null}
        {entry.error ? <p className="network-explain-error">{entry.error}</p> : null}
      </div>
    );
  }

  if (tab === "response") {
    if (entry.error) {
      return <pre className="net-json error">{entry.error}</pre>;
    }
    if (entry.status === "pending") {
      return <p className="hint network-empty">Waiting for response…</p>;
    }
    if (entry.kind === "sse") {
      if (!entry.streamText) {
        return (
          <p className="hint network-empty">
            Connecting… waiting for <code>event: initialize</code>, then{" "}
            <code>event: update</code> frames when the record changes.
          </p>
        );
      }
      return <pre className="net-json net-stream">{entry.streamText}</pre>;
    }
    return (
      <pre className="net-json">
        {entry.response !== undefined
          ? JSON.stringify(entry.response, null, 2)
          : "No response body"}
      </pre>
    );
  }

  // Request / Headers tab
  if (entry.kind === "sse") {
    return (
      <div className="network-headers">
        <p className="hint network-empty">
          Handshake only — no JSON request body. Selection is signed into headers when the
          stream opens; after that the server only writes the response stream.
        </p>
        <pre className="net-json">{formatSseHeaders(entry)}</pre>
        <p className="hint network-empty" style={{ marginTop: "0.75rem" }}>
          Signed selection (<code>X-Mesh-Query</code>)
        </p>
        <pre className="net-json">
          {entry.payload !== undefined
            ? JSON.stringify(entry.payload, null, 2)
            : "—"}
        </pre>
      </div>
    );
  }

  return (
    <pre className="net-json">
      {entry.payload !== undefined
        ? JSON.stringify(entry.payload, null, 2)
        : "No payload"}
    </pre>
  );
}

function formatSseHeaders(entry: WireEntry): string {
  return [
    `GET ${displayPath(entry.url)} HTTP/1.1`,
    "Accept: text/event-stream",
    "X-Mesh-Format: json",
    "X-Mesh-Query: <signed selection>",
    "X-Mesh-Token: <session>",
    "X-Mesh-Signature: <hmac>",
  ].join("\n");
}

function tabLabel(tab: Tab, kind: WireEntry["kind"]): string {
  if (kind === "sse") {
    if (tab === "query") return "Headers";
    if (tab === "response") return "Response";
    return "Explain";
  }
  if (tab === "query") return "Query";
  if (tab === "response") return "Response";
  return "Explain";
}

function typeLabel(entry: WireEntry): string {
  if (entry.kind === "sse") return "eventsource";
  if (entry.kind === "auth" || entry.kind === "write" || entry.kind === "upload") {
    return "json";
  }
  return "json";
}

function methodClass(entry: WireEntry): string {
  if (entry.kind === "sse" || entry.method === "GET") return "is-get";
  if (entry.method === "POST" || entry.method === "PATCH") return "is-post";
  if (entry.method === "DELETE") return "is-sse";
  if (entry.method === "SSE") return "is-sse";
  return "";
}
