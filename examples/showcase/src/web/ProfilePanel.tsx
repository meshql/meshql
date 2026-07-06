import { FormEvent, useState } from "react";
import type { UserRow } from "./types.js";
import { useMesh } from "./MeshContext.js";

export function ProfilePanel({
  user,
  onUploaded,
}: {
  user: UserRow | null;
  onUploaded?: () => Promise<void>;
}) {
  const { auth, uploadAvatar } = useMesh();
  const [flash, setFlash] = useState<string>();
  const [err, setErr] = useState<string>();
  const [uploading, setUploading] = useState(false);

  if (!auth) return null;

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement)
      .files?.[0];
    if (!file) return;

    setFlash(undefined);
    setErr(undefined);
    setUploading(true);
    try {
      await uploadAvatar(file);
      setFlash("Avatar uploaded");
      await onUploaded?.();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="panel" id="profile">
      <h2>
        Profile <span className="badge">GET /mesh/user/:id</span>
      </h2>
      {flash ? <div className="flash">{flash}</div> : null}
      {err ? <div className="flash err">{err}</div> : null}
      <div className="profile">
        {user?.avatar ? (
          <div className="avatar">
            <img src={`/uploads/${user.avatar}`} alt="" />
          </div>
        ) : (
          <div className="avatar">no avatar</div>
        )}
        <div>
          <div>
            <strong>{user?.name ?? auth.name}</strong>
          </div>
          <div className="meta profile-meta">
            role={user?.role ?? auth.role}
            {" · "}
            email=
            {user?.email !== undefined ? user.email : <em>hidden</em>}
          </div>
        </div>
      </div>
      {auth.role !== "guest" ? (
        <form onSubmit={onUpload} style={{ marginTop: "0.85rem" }}>
          <label style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            Upload avatar
            <input type="file" name="file" accept="image/*" required />
          </label>
          <button
            type="submit"
            className="btn primary"
            style={{ marginTop: "0.5rem", width: "100%" }}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
