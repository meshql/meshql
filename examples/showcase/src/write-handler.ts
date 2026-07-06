import { IntegrityError } from "@meshql/core";
import { decodeQuery } from "@meshql/http";
import type { IntegrityConfig } from "@meshql/integrity";
import type { Request } from "express";
import {
  createComment,
  createPost,
  CrudError,
  deleteComment,
  deletePost,
  updatePost,
} from "./crud.js";
import { verifyMeshRequest } from "./verify-request.js";

export interface WritePayload {
  op: "create" | "update" | "delete";
  entity: "post" | "comment";
  id?: number;
  data?: {
    title?: string;
    body?: string;
    status?: string;
    postId?: number;
  };
}

function parseWritePayload(raw: string): WritePayload {
  const parsed = JSON.parse(raw) as { $write?: WritePayload };
  if (!parsed.$write || typeof parsed.$write !== "object") {
    throw new CrudError("Missing $write in signed payload");
  }
  return parsed.$write;
}

/** POST /mesh/write — signed CRUD until core mutations land. */
export function mountWriteRoute(
  app: import("express").Express,
  config: IntegrityConfig,
): void {
  app.post("/mesh/write", (req, res) => {
    try {
      const auth = verifyMeshRequest(req, config);
      const { raw } = decodeQuery({
        headers: req.headers as Record<string, string | string[] | undefined>,
      });
      const write = parseWritePayload(raw);

      let result: unknown;
      switch (write.entity) {
        case "post": {
          if (write.op === "create") {
            result = createPost(auth, {
              title: write.data?.title ?? "",
              body: write.data?.body ?? "",
              status: write.data?.status ?? "draft",
            });
            break;
          }
          if (write.op === "update" && write.id !== undefined) {
            updatePost(auth, write.id, {
              title: write.data?.title ?? "",
              body: write.data?.body ?? "",
              status: write.data?.status ?? "draft",
            });
            result = { id: write.id, updated: true };
            break;
          }
          if (write.op === "delete" && write.id !== undefined) {
            deletePost(auth, write.id);
            result = { id: write.id, deleted: true };
            break;
          }
          throw new CrudError("Invalid post write operation");
        }
        case "comment": {
          if (write.op === "create" && write.data?.postId !== undefined) {
            result = createComment(auth, write.data.postId, write.data.body ?? "");
            break;
          }
          if (write.op === "delete" && write.id !== undefined) {
            deleteComment(auth, write.id);
            result = { id: write.id, deleted: true };
            break;
          }
          throw new CrudError("Invalid comment write operation");
        }
        default:
          throw new CrudError(`Unknown entity '${String(write.entity)}'`);
      }

      res.json(result);
    } catch (error) {
      if (error instanceof IntegrityError) {
        res.status(error.details?.code === "TOKEN_EXPIRED" ? 401 : 403).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      if (error instanceof CrudError) {
        res.status(400).json({ error: "CrudError", message: error.message });
        return;
      }
      res.status(500).json({
        error: "ServerError",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
