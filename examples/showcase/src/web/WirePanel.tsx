import type { WireEntry } from "./types.js";

export function WirePanel({ entries }: { entries: WireEntry[] }) {
  return (
    <div className="panel" id="wire">
      <h2>MeshQL network</h2>
      <p className="hint">
        Recent calls to <code>/mesh/*</code> from <code>@meshql/client</code>
      </p>
      {entries.length === 0 ? (
        <p className="hint">Interact with the dashboard to see requests here.</p>
      ) : (
        entries.map((entry, i) => (
          <div className="wire-entry" key={`${entry.url}-${i}`}>
            <div className="wire-meta">
              <strong>{entry.method}</strong> {entry.url}
            </div>
            {entry.payload ? (
              <pre className="wire">{JSON.stringify(entry.payload, null, 2)}</pre>
            ) : null}
            {entry.error ? (
              <pre className="wire error">{entry.error}</pre>
            ) : entry.response ? (
              <pre className="wire">{JSON.stringify(entry.response, null, 2)}</pre>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
