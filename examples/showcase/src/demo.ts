/**
 * Feature tour for the MeshQL showcase.
 *
 * Start the server first:
 *   pnpm --filter showcase start
 *
 * Then in another terminal:
 *   pnpm --filter showcase demo
 */
import { createAuthClient, createClient } from "@meshql/client";
import { encodeCursor } from "@meshql/sqlite";

const BASE = process.env.SHOWCASE_URL ?? "http://localhost:3010/mesh";

function section(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 50 - title.length))}`);
}

function ok(label: string, detail?: unknown) {
  console.log(`  ✓ ${label}`);
  if (detail !== undefined) {
    console.log(`    ${JSON.stringify(detail)}`);
  }
}

async function login(email: string, password = "demo") {
  const auth = createAuthClient({ url: BASE });
  await auth.login({ email, password });
  return auth;
}

async function main() {
  console.log("MeshQL showcase — feature tour");
  console.log(`API: ${BASE}`);

  // ── 1. Auth ──────────────────────────────────────────────
  section("1. Integrity login");
  const guest = await login("guest@example.com");
  const author = await login("ada@example.com");
  const admin = await login("admin@example.com");
  ok("logged in as guest, author (Ada), and admin");

  // ── 2. Nested field selection ────────────────────────────
  section("2. Nested field selection");
  const post = await author.query(
    {
      post: {
        id: true,
        title: true,
        author: { name: true },
        comments: { body: true },
      },
    },
    { entityId: "1" },
  );
  ok("post with author + comments", post);

  // ── 3. List + filter + orderBy ───────────────────────────
  section("3. List queries ($list in signed payload)");
  const published = await guest.query(
    { post: { id: true, title: true, status: true } },
    {
      list: {
        limit: 10,
        orderBy: [{ field: "createdAt", dir: "desc" }],
      },
    },
  );
  ok("guest list (published only)", published);

  const drafts = await author.query(
    { post: { id: true, title: true, status: true } },
    {
      list: {
        filter: [{ field: "status", op: "eq", value: "draft" }],
      },
    },
  );
  ok("author can list drafts", drafts);

  // ── 4. Cursor pagination ─────────────────────────────────
  section("4. Cursor pagination");
  const page1 = (await author.query(
    { post: { id: true, title: true } },
    {
      list: {
        limit: 1,
        orderBy: [{ field: "id", dir: "asc" }],
      },
    },
  )) as Array<{ id: number; title: string }>;
  const cursor = encodeCursor({ id: page1[0]!.id });
  const page2 = await author.query(
    { post: { id: true, title: true } },
    {
      list: {
        limit: 1,
        cursor,
        orderBy: [{ field: "id", dir: "asc" }],
      },
    },
  );
  ok("page 1", page1);
  ok("page 2 (after cursor)", page2);

  // ── 5. Access control ────────────────────────────────────
  section("5. Field access (user.email)");
  const guestUser = await guest.query(
    { user: { id: true, name: true, email: true } },
    { entityId: "1" },
  );
  const adminUser = await admin.query(
    { user: { id: true, name: true, email: true } },
    { entityId: "1" },
  );
  ok("guest cannot see email", guestUser);
  ok("admin can see email", adminUser);

  section("6. Row access (draft posts)");
  const guestDraft = await guest.query(
    { post: { id: true, title: true, status: true } },
    { entityId: "2" },
  );
  const authorDraft = await author.query(
    { post: { id: true, title: true, status: true } },
    { entityId: "2" },
  );
  ok("guest blocked from draft (empty)", guestDraft);
  ok("author can read draft", authorDraft);

  // ── 7. Upload ────────────────────────────────────────────
  section("7. Avatar upload (signed contentHash)");
  const avatarBytes = new TextEncoder().encode("fake-png-bytes");
  const uploaded = await author.upload({
    entity: "user",
    id: "1",
    field: "avatar",
    file: { buffer: avatarBytes, filename: "ada.png", mimetype: "image/png" },
  });
  ok("uploaded avatar", uploaded);

  const userWithAvatar = await author.query(
    { user: { id: true, name: true, avatar: true } },
    { entityId: "1" },
  );
  ok("user now has avatar path", userWithAvatar);

  // ── 8. Tamper detection ──────────────────────────────────
  section("8. Tampered upload body → 401");
  const unsigned = createClient({ url: BASE });
  try {
    await unsigned.upload({
      entity: "user",
      id: "1",
      field: "avatar",
      file: { buffer: avatarBytes, filename: "nope.png", mimetype: "image/png" },
    });
    console.log("  ✗ expected upload without auth to fail");
  } catch (error) {
    ok("rejected unsigned upload", (error as Error).message);
  }

  console.log("\nAll showcase features exercised.\n");
}

main().catch((error) => {
  console.error("\nDemo failed — is the server running?");
  console.error("  pnpm --filter showcase start\n");
  console.error(error);
  process.exit(1);
});
