import { createHash } from "node:crypto";
import { createMesh, type MeshFile } from "@meshql/core";
import { signQuery } from "@meshql/http";
import { describe, expect, it, vi } from "vitest";
import { issueToken, withIntegrity } from "./plugin.js";

const schema = {
  entities: {
    user: { fields: ["id", "avatar"] },
  },
  joins: {},
};

const file: MeshFile = {
  buffer: Buffer.from("avatar-bytes"),
  mimetype: "image/png",
  originalName: "avatar.png",
  size: 12,
};

function contentHash(buffer: Buffer): string {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

describe("integrity multipart uploads", () => {
  it("accepts a valid signed upload", async () => {
    const upload = vi.fn(async () => ({ avatar: "ok" }));
    const mesh = withIntegrity(createMesh(schema), {
      secret: "test-secret",
      authenticate: async () => ({
        userId: "u1",
        sessionId: "s1",
        role: "admin",
      }),
    });
    mesh.resolveUpload("user.avatar", upload);

    const { signingToken, token } = issueToken(mesh.integrity, {
      userId: "u1",
      sessionId: "s1",
      role: "admin",
    });

    const hash = contentHash(file.buffer);
    const raw = JSON.stringify({
      user: { avatar: { upload: true } },
      contentHash: hash,
    });
    const headers = signQuery(raw, {
      format: "json",
      signingToken,
      token,
    });

    const result = await mesh.executeUpload({
      entity: "user",
      field: "avatar",
      entityId: "1",
      file,
      query: raw,
      transport: {
        queryHeader: headers["X-Mesh-Query"]!,
        signature: headers["X-Mesh-Signature"],
        token: headers["X-Mesh-Token"],
      },
    });

    expect(result).toEqual({ avatar: "ok" });
    expect(upload).toHaveBeenCalledOnce();
  });

  it("rejects a tampered file body", async () => {
    const mesh = withIntegrity(createMesh(schema), {
      secret: "test-secret",
      authenticate: async () => ({
        userId: "u1",
        sessionId: "s1",
      }),
    });
    mesh.resolveUpload("user.avatar", async () => ({ avatar: "ok" }));

    const { signingToken, token } = issueToken(mesh.integrity, {
      userId: "u1",
      sessionId: "s1",
    });

    const hash = contentHash(file.buffer);
    const raw = JSON.stringify({
      user: { avatar: { upload: true } },
      contentHash: hash,
    });
    const headers = signQuery(raw, { format: "json", signingToken, token });

    await expect(
      mesh.executeUpload({
        entity: "user",
        field: "avatar",
        file: { ...file, buffer: Buffer.from("tampered") },
        query: raw,
        transport: {
          queryHeader: headers["X-Mesh-Query"]!,
          signature: headers["X-Mesh-Signature"],
          token: headers["X-Mesh-Token"],
        },
      }),
    ).rejects.toThrow("contentHash mismatch");
  });

  it("rejects a wrong contentHash in the signed payload", async () => {
    const mesh = withIntegrity(createMesh(schema), {
      secret: "test-secret",
      authenticate: async () => ({
        userId: "u1",
        sessionId: "s1",
      }),
    });
    mesh.resolveUpload("user.avatar", async () => ({ avatar: "ok" }));

    const { signingToken, token } = issueToken(mesh.integrity, {
      userId: "u1",
      sessionId: "s1",
    });

    const raw = JSON.stringify({
      user: { avatar: { upload: true } },
      contentHash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    });
    const headers = signQuery(raw, { format: "json", signingToken, token });

    await expect(
      mesh.executeUpload({
        entity: "user",
        field: "avatar",
        file,
        query: raw,
        transport: {
          queryHeader: headers["X-Mesh-Query"]!,
          signature: headers["X-Mesh-Signature"],
          token: headers["X-Mesh-Token"],
        },
      }),
    ).rejects.toThrow("contentHash mismatch");
  });
});
