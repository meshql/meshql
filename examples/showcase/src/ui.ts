import type { ListOptions } from "@meshql/core";
import type { Express, Request, Response } from "express";
import { encodeCursor } from "@meshql/sqlite";
import { meshQuery, meshUpload, type CallResult } from "./mesh-call.js";
import { mesh } from "./mesh.js";
import {
  DEMO_USERS,
  getSession,
  loginAs,
  logout,
  type Session,
} from "./session.js";

type PostRow = {
  id: number;
  title?: string;
  body?: string;
  status?: string;
  author?: { name?: string };
  comments?: Array<{ body?: string }>;
};

type UserRow = {
  id: number;
  name?: string;
  email?: string;
  role?: string;
  avatar?: string;
};

function esc(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(body: string, title = "MeshQL Showcase"): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="/styles.css" />
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
</head>
<body>
  <div class="wrap">
    ${body}
  </div>
</body>
</html>`;
}

function rolesPanel(session: Session): string {
    const buttons = DEMO_USERS.map((u) => {
    const active = session.email === u.email ? "active" : "";
    return `<button type="button" class="${active}"
      hx-post="/ui/login" hx-vals='{"email":"${u.email}"}'>
      ${esc(u.label)}
      <small>${esc(u.email)} · role=${esc(u.role)}</small>
    </button>`;
  }).join("");

  return `
    <div class="panel" id="roles">
      <h2>Act as</h2>
      <p class="whoami">Signed in as <strong>${esc(session.name)}</strong>
        <span class="badge">${esc(session.role)}</span></p>
      <div class="roles">${buttons}</div>
      <p class="hint">Switching roles re-issues an integrity token and re-runs queries under that identity.</p>
    </div>`;
}

function optionsPanel(opts: {
  fields: Set<string>;
  limit: number;
  orderBy: string;
  status: string;
}): string {
  const field = (name: string, label: string) =>
    `<label><input type="checkbox" name="fields" value="${name}" ${
      opts.fields.has(name) ? "checked" : ""
    }/> ${label}</label>`;

  return `
    <div class="panel" id="options">
      <h2>Query options</h2>
      <form id="query-form"
        hx-get="/ui/posts"
        hx-target="#results"
        hx-swap="outerHTML"
        hx-trigger="change, submit"
        hx-include="this">
        <p class="hint" style="margin-top:0">Field selection</p>
        <div class="field-grid">
          ${field("title", "title")}
          ${field("body", "body")}
          ${field("status", "status")}
          ${field("author", "author { name }")}
          ${field("comments", "comments { body }")}
        </div>

        <div class="row" style="margin-top:0.85rem">
          <label>limit
            <input type="number" name="limit" min="1" max="50" value="${opts.limit}" />
          </label>
          <label>orderBy
            <select name="orderBy">
              <option value="createdAt:desc" ${opts.orderBy === "createdAt:desc" ? "selected" : ""}>createdAt desc</option>
              <option value="createdAt:asc" ${opts.orderBy === "createdAt:asc" ? "selected" : ""}>createdAt asc</option>
              <option value="id:asc" ${opts.orderBy === "id:asc" ? "selected" : ""}>id asc</option>
              <option value="id:desc" ${opts.orderBy === "id:desc" ? "selected" : ""}>id desc</option>
            </select>
          </label>
          <label>status filter
            <select name="status">
              <option value="" ${opts.status === "" ? "selected" : ""}>any</option>
              <option value="published" ${opts.status === "published" ? "selected" : ""}>published</option>
              <option value="draft" ${opts.status === "draft" ? "selected" : ""}>draft</option>
            </select>
          </label>
        </div>
        <p class="hint">Guests only ever see published posts (server-side filter + row access).</p>
      </form>
    </div>`;
}

function buildSelection(fields: Set<string>): Record<string, unknown> {
  const post: Record<string, unknown> = { id: true };
  if (fields.has("title")) post.title = true;
  if (fields.has("body")) post.body = true;
  if (fields.has("status")) post.status = true;
  if (fields.has("author")) post.author = { name: true };
  if (fields.has("comments")) post.comments = { body: true };
  return { post };
}

function buildList(opts: {
  limit: number;
  orderBy: string;
  status: string;
  cursor?: string;
}): ListOptions {
  const [field, dir] = opts.orderBy.split(":") as [string, "asc" | "desc"];
  const list: ListOptions = {
    limit: opts.limit,
    orderBy: [{ field, dir }],
  };
  if (opts.status) {
    list.filter = [{ field: "status", op: "eq", value: opts.status }];
  }
  if (opts.cursor) list.cursor = opts.cursor;
  return list;
}

function parseOpts(req: Request) {
  const fieldsRaw = req.query.fields;
  const fields = new Set<string>(
    Array.isArray(fieldsRaw)
      ? fieldsRaw.map(String)
      : fieldsRaw
        ? [String(fieldsRaw)]
        : ["title", "status", "author", "comments"],
  );
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
  const orderBy = String(req.query.orderBy || "createdAt:desc");
  const status = String(req.query.status ?? "");
  const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
  const postId = req.query.postId ? String(req.query.postId) : undefined;
  return { fields, limit, orderBy, status, cursor, postId };
}

function wirePanel(result: CallResult): string {
  const payload = result.list
    ? { ...result.selection, $list: result.list }
    : result.selection;
  const response = result.error
    ? { error: result.error }
    : result.data;

  return `
    <div class="panel" id="wire">
      <h2>Wire payload (signed)</h2>
      <pre class="wire">${esc(JSON.stringify(payload, null, 2))}</pre>
      <h2 style="margin-top:1rem">MeshQL response</h2>
      <pre class="wire ${result.error ? "error" : ""}">${esc(
        JSON.stringify(response, null, 2),
      )}</pre>
    </div>`;
}

function renderPosts(
  posts: PostRow[],
  opts: ReturnType<typeof parseOpts>,
  detail?: PostRow | null,
  detailError?: string,
): string {
  const cards = posts
    .map((p) => {
      const active = opts.postId === String(p.id) ? " style=\"border-color:var(--accent)\"" : "";
      return `<button type="button" class="post-card"${active}
        hx-get="/ui/posts"
        hx-include="#query-form"
        hx-vals='{"postId":"${p.id}"}'
        hx-target="#results"
        hx-swap="outerHTML">
        <h3>${esc(p.title ?? `(post #${p.id})`)}</h3>
        <div class="meta">
          #${p.id}
          ${p.status ? `<span class="status ${esc(p.status)}">${esc(p.status)}</span>` : ""}
          ${p.author?.name ? ` · ${esc(p.author.name)}` : ""}
          ${p.comments ? ` · ${p.comments.length} comments` : ""}
        </div>
      </button>`;
    })
    .join("");

  const lastId = posts.length > 0 ? posts[posts.length - 1]!.id : undefined;
  const more =
    lastId !== undefined
      ? `<button type="button" class="btn" style="margin-top:0.75rem;width:100%;text-align:center"
          hx-get="/ui/posts"
          hx-include="#query-form"
          hx-vals='{"cursor":"${encodeCursor({ id: lastId })}"}'
          hx-target="#results"
          hx-swap="outerHTML">
          Load more (cursor after id=${lastId})
        </button>`
      : "";

  let detailHtml = "";
  if (detailError) {
    detailHtml = `<div class="detail"><div class="flash err">${esc(detailError)}</div></div>`;
  } else if (detail) {
    detailHtml = `
      <div class="detail">
        <h3>${esc(detail.title ?? `Post #${detail.id}`)}</h3>
        ${detail.status ? `<span class="status ${esc(detail.status)}">${esc(detail.status)}</span>` : ""}
        ${detail.author?.name ? `<span class="meta"> by ${esc(detail.author.name)}</span>` : ""}
        ${detail.body ? `<p class="body">${esc(detail.body)}</p>` : ""}
        ${
          detail.comments?.length
            ? `<ul class="comments">${detail.comments
                .map((c) => `<li>${esc(c.body)}</li>`)
                .join("")}</ul>`
            : ""
        }
      </div>`;
  }

  return `
    <div id="results">
      <div class="panel">
        <h2>Posts <span class="loading-indicator">loading…</span></h2>
        ${posts.length === 0 ? `<p class="hint">No posts for this role / filter.</p>` : ""}
        <div class="post-list">${cards}</div>
        ${more}
        ${detailHtml}
      </div>
    </div>`;
}

function profilePanel(user: UserRow | null, flash?: string, err?: string): string {
  const avatar = user?.avatar
    ? `<div class="avatar"><img src="/uploads/${esc(user.avatar)}" alt="" /></div>`
    : `<div class="avatar">no avatar</div>`;

  return `
    <div class="panel" id="profile">
      <h2>Profile (field access + upload)</h2>
      ${flash ? `<div class="flash">${esc(flash)}</div>` : ""}
      ${err ? `<div class="flash err">${esc(err)}</div>` : ""}
      <div class="profile">
        ${avatar}
        <div>
          <div><strong>${esc(user?.name ?? "—")}</strong></div>
          <div class="meta" style="font-family:var(--mono);font-size:0.8rem;color:var(--muted)">
            role=${esc(user?.role ?? "—")}
            · email=${user?.email !== undefined ? esc(user.email) : "<span style=\"color:var(--warn)\">stripped</span>"}
          </div>
        </div>
      </div>
      <form hx-post="/ui/upload" hx-encoding="multipart/form-data" hx-target="#profile" hx-swap="outerHTML"
        style="margin-top:0.85rem">
        <label style="font-size:0.8rem;color:var(--muted)">Upload avatar
          <input type="file" name="file" accept="image/*,.png,.jpg,.txt" required />
        </label>
        <button type="submit" class="btn primary" style="margin-top:0.5rem;width:100%">Upload with contentHash</button>
      </form>
      <p class="hint">Guests/authors never receive <code>user.email</code> — only admin does. Toggle roles to see the field disappear.</p>
    </div>`;
}

async function loadProfile(session: Session): Promise<UserRow | null> {
  const result = await meshQuery(
    session,
    { user: { id: true, name: true, email: true, role: true, avatar: true } },
    { entityId: session.userId },
  );
  if (result.error || !result.data || Array.isArray(result.data)) return null;
  return result.data as UserRow;
}

async function pageBody(req: Request, session: Session): Promise<string> {
  const opts = parseOpts(req);
  const selection = buildSelection(opts.fields);
  const list = buildList(opts);

  const listResult = await meshQuery(session, selection, { list });
  const posts = (Array.isArray(listResult.data) ? listResult.data : []) as PostRow[];

  let detail: PostRow | null = null;
  let detailError: string | undefined;
  let wire = listResult;

  if (opts.postId) {
    const detailResult = await meshQuery(session, selection, {
      entityId: opts.postId,
    });
    wire = detailResult;
    if (detailResult.error) {
      detailError = detailResult.error;
    } else if (
      detailResult.data &&
      typeof detailResult.data === "object" &&
      !Array.isArray(detailResult.data) &&
      Object.keys(detailResult.data as object).length > 0
    ) {
      detail = detailResult.data as PostRow;
    } else {
      detailError = "Empty response (row access denied or not found)";
    }
  }

  const user = await loadProfile(session);

  return `
    <header class="app">
      <h1>MeshQL <span>interactive showcase</span></h1>
      <span class="badge">integrity · access · lists · uploads</span>
    </header>
    <div class="grid">
      <div class="stack">
        ${rolesPanel(session)}
        ${optionsPanel(opts)}
        ${profilePanel(user)}
      </div>
      <div class="stack">
        ${renderPosts(posts, opts, detail, detailError)}
        ${wirePanel(wire)}
      </div>
    </div>`;
}

/** Mount interactive UI routes. */
export function mountUi(app: Express): void {
  app.get("/", async (req, res) => {
    let session = getSession(req);
    if (!session) {
      session = loginAs(res, mesh.integrity, "guest@example.com");
    }
    const body = await pageBody(req, session);
    res.type("html").send(layout(body));
  });

  app.post("/ui/login", (req, res) => {
    const email = String(req.body?.email ?? "guest@example.com");
    loginAs(res, mesh.integrity, email);
    res.setHeader("HX-Redirect", "/");
    res.status(200).end();
  });

  app.post("/ui/logout", (req, res) => {
    logout(req, res);
    res.redirect("/");
  });

  app.get("/ui/posts", async (req, res) => {
    const session = getSession(req);
    if (!session) {
      res.status(401).send(`<div class="flash err">Not signed in</div>`);
      return;
    }

    const opts = parseOpts(req);
    const selection = buildSelection(opts.fields);
    const list = buildList(opts);

    // Cursor "load more" appends — for simplicity we replace the list with the next page.
    const listResult = await meshQuery(session, selection, { list });
    const posts = (Array.isArray(listResult.data) ? listResult.data : []) as PostRow[];

    let detail: PostRow | null = null;
    let detailError: string | undefined;
    let wire = listResult;

    if (opts.postId) {
      const detailResult = await meshQuery(session, selection, {
        entityId: opts.postId,
      });
      wire = detailResult;
      if (detailResult.error) {
        detailError = detailResult.error;
      } else if (
        detailResult.data &&
        typeof detailResult.data === "object" &&
        !Array.isArray(detailResult.data) &&
        Object.keys(detailResult.data as object).length > 0
      ) {
        detail = detailResult.data as PostRow;
      } else {
        detailError = "Empty response (row access denied or not found)";
      }
    }

    // Update results in-place and swap the wire panel out-of-band.
    const wireHtml = wirePanel(wire).replace(
      'id="wire"',
      'id="wire" hx-swap-oob="true"',
    );
    res.type("html").send(`${renderPosts(posts, opts, detail, detailError)}${wireHtml}`);
  });

  app.post("/ui/upload", async (req, res) => {
    const session = getSession(req);
    if (!session) {
      res.status(401).send(profilePanel(null, undefined, "Not signed in"));
      return;
    }

    try {
      const { parseMultipart } = await import("@meshql/http");
      const parsed = await parseMultipart(req, {
        headers: req.headers as Record<string, string | string[] | undefined>,
      });
      const result = await meshUpload(session, parsed.file);
      const user = await loadProfile(session);
      res.send(
        profilePanel(
          user,
          result.error ? undefined : `Uploaded → ${JSON.stringify(result.data)}`,
          result.error,
        ),
      );
    } catch (error) {
      const user = await loadProfile(session);
      res.send(
        profilePanel(
          user,
          undefined,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  });
}
