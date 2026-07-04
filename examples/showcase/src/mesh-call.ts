import type { ListOptions } from "@meshql/core";
import { signQuery } from "@meshql/http";
import { mesh } from "./mesh.js";
import type { Session } from "./session.js";

export interface CallResult {
  data: unknown;
  selection: Record<string, unknown>;
  list?: ListOptions;
  error?: string;
}

/** Run a MeshQL query through the real integrity-signed path. */
export async function meshQuery(
  session: Session,
  selection: Record<string, unknown>,
  options: { entityId?: string; list?: ListOptions } = {},
): Promise<CallResult> {
  const root = Object.keys(selection)[0];
  if (!root) {
    return { data: null, selection, error: "empty selection" };
  }

  const payload = options.list
    ? { ...selection, $list: options.list }
    : selection;
  const raw = JSON.stringify(payload);
  const headers = signQuery(raw, {
    format: "json",
    signingToken: session.signingToken,
    token: session.token,
  });

  try {
    const data = await mesh.execute(raw, {
      format: "json",
      list: options.list !== undefined || !options.entityId,
      listOptions: options.list,
      transport: {
        queryHeader: headers["X-Mesh-Query"]!,
        signature: headers["X-Mesh-Signature"],
        token: headers["X-Mesh-Token"],
      },
      context: {
        requestId: crypto.randomUUID(),
        method: "GET",
        entityId: options.entityId,
        entity: root,
      },
    });
    return { data, selection, list: options.list };
  } catch (error) {
    return {
      data: null,
      selection,
      list: options.list,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Upload a file through the signed upload path. */
export async function meshUpload(
  session: Session,
  file: { buffer: Buffer; mimetype: string; originalName: string; size: number },
): Promise<CallResult> {
  const { createHash } = await import("node:crypto");
  const contentHash = `sha256:${createHash("sha256").update(file.buffer).digest("hex")}`;
  const selection = {
    user: { avatar: { upload: true } },
    contentHash,
  };
  const raw = JSON.stringify(selection);
  const headers = signQuery(raw, {
    format: "json",
    signingToken: session.signingToken,
    token: session.token,
  });

  try {
    const data = await mesh.executeUpload({
      entity: "user",
      field: "avatar",
      entityId: session.userId,
      file,
      query: raw,
      transport: {
        queryHeader: headers["X-Mesh-Query"]!,
        signature: headers["X-Mesh-Signature"],
        token: headers["X-Mesh-Token"],
      },
    });
    return { data, selection };
  } catch (error) {
    return {
      data: null,
      selection,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
