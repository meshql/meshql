import { describe, expect, it, vi } from "vitest";
import { createMesh, extractContentHash } from "./index.js";
import type { MeshFile } from "./index.js";

const schema = {
  entities: {
    user: { fields: ["id", "name", "avatar"] },
  },
  joins: {},
};

const file: MeshFile = {
  buffer: Buffer.from("avatar-bytes"),
  mimetype: "image/png",
  originalName: "avatar.png",
  size: 12,
};

describe("extractContentHash", () => {
  it("reads contentHash from the wire payload", () => {
    expect(
      extractContentHash(
        JSON.stringify({
          user: { avatar: { upload: true } },
          contentHash: "sha256:abc",
        }),
      ),
    ).toBe("sha256:abc");
  });
});

describe("createMesh.executeUpload", () => {
  it("routes to the registered upload resolver", async () => {
    const upload = vi.fn(async (received: MeshFile) => ({
      avatar: `stored:${received.originalName}`,
    }));

    const mesh = createMesh(schema).resolveUpload("user.avatar", upload);

    const result = await mesh.executeUpload({
      entity: "user",
      field: "avatar",
      entityId: "1",
      file,
      query: JSON.stringify({
        user: { avatar: { upload: true } },
        contentHash: "sha256:deadbeef",
      }),
    });

    expect(upload).toHaveBeenCalledOnce();
    expect(result).toEqual({ avatar: "stored:avatar.png" });
  });

  it("runs onUpload plugins before the resolver", async () => {
    const order: string[] = [];
    const mesh = createMesh(schema)
      .use({
        name: "check",
        async onUpload(f) {
          order.push("plugin");
          return f;
        },
      })
      .resolveUpload("user.avatar", async () => {
        order.push("resolver");
        return { ok: true };
      });

    await mesh.executeUpload({
      entity: "user",
      field: "avatar",
      file,
      query: JSON.stringify({ user: { avatar: { upload: true } } }),
    });

    expect(order).toEqual(["plugin", "resolver"]);
  });

  it("throws when no upload resolver is registered", async () => {
    const mesh = createMesh(schema);
    await expect(
      mesh.executeUpload({
        entity: "user",
        field: "avatar",
        file,
        query: "{}",
      }),
    ).rejects.toThrow("No upload resolver registered for 'user.avatar'");
  });
});
