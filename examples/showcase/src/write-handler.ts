import { IntegrityError } from "@meshql/core";
import { decodeQuery } from "@meshql/http";
import type { IntegrityConfig } from "@meshql/integrity";
import {
  entityChannel,
  notifyEntityUpdate,
  type PubSubStore,
} from "@meshql/pubsub";
import type { Express, Request, Response } from "express";
import { db } from "./db.js";
import {
  createComment,
  createPost,
  CrudError,
  deleteComment,
  deletePost,
  updatePost,
} from "./crud.js";
import { verifyMeshRequest } from "./verify-request.js";
import type { AuthContext } from "./auth-context.js";

type PostBody = {
  title?: string;
  body?: string;
  status?: string;
};

type CommentBody = {
  postId?: number;
  body?: string;
};

function notifyPostChange(pubsub: PubSubStore, postId: number): void {
  notifyEntityUpdate(pubsub, "post", postId);
  void Promise.resolve(pubsub.publish(entityChannel("post"), { type: "updated" }));
}

function commentPostId(commentId: number): number | undefined {
  const row = db
    .prepare("SELECT post_id FROM comments WHERE id = ?")
    .get(commentId) as { post_id: number } | undefined;
  return row?.post_id;
}

function paramId(req: Request): number {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw new CrudError("Invalid id");
  }
  return id;
}

/** Use the signed X-Mesh-Query JSON as the write payload (body is for visibility). */
function signedBody<T extends Record<string, unknown>>(
  req: Request,
  fallback: T = {} as T,
): T {
  const { raw } = decodeQuery({
    headers: req.headers as Record<string, string | string[] | undefined>,
  });
  let signed: unknown;
  try {
    signed = JSON.parse(raw);
  } catch {
    throw new CrudError("Invalid signed write payload");
  }
  if (!signed || typeof signed !== "object" || Array.isArray(signed)) {
    throw new CrudError("Invalid signed write payload");
  }
  if (Object.keys(signed as object).length === 0) {
    return fallback;
  }
  return signed as T;
}

function sendWriteError(res: Response, error: unknown): void {
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

function withAuth(
  config: IntegrityConfig,
  handler: (req: Request, res: Response, auth: AuthContext) => void,
) {
  return (req: Request, res: Response) => {
    try {
      const auth = verifyMeshRequest(req, config);
      handler(req, res, auth);
    } catch (error) {
      sendWriteError(res, error);
    }
  };
}

/**
 * Plain REST CRUD for the showcase (preview until core mutations).
 *
 * POST   /mesh/post
 * PATCH  /mesh/post/:id
 * DELETE /mesh/post/:id
 * POST   /mesh/comment
 * DELETE /mesh/comment/:id
 */
export function mountWriteRoute(
  app: Express,
  config: IntegrityConfig,
  pubsub: PubSubStore,
): void {
  app.post(
    "/mesh/post",
    withAuth(config, (req, res, auth) => {
      const data = signedBody<PostBody>(req);
      const result = createPost(auth, {
        title: data.title ?? "",
        body: data.body ?? "",
        status: data.status ?? "draft",
      });
      notifyPostChange(pubsub, result.id);
      res.status(201).json(result);
    }),
  );

  app.patch(
    "/mesh/post/:id",
    withAuth(config, (req, res, auth) => {
      const id = paramId(req);
      const data = signedBody<PostBody>(req);
      updatePost(auth, id, {
        title: data.title ?? "",
        body: data.body ?? "",
        status: data.status ?? "draft",
      });
      notifyPostChange(pubsub, id);
      res.json({ id, updated: true });
    }),
  );

  app.delete(
    "/mesh/post/:id",
    withAuth(config, (req, res, auth) => {
      const id = paramId(req);
      signedBody(req, {});
      deletePost(auth, id);
      notifyPostChange(pubsub, id);
      res.json({ id, deleted: true });
    }),
  );

  app.post(
    "/mesh/comment",
    withAuth(config, (req, res, auth) => {
      const data = signedBody<CommentBody>(req);
      if (data.postId === undefined) {
        throw new CrudError("postId is required");
      }
      const result = createComment(auth, data.postId, data.body ?? "");
      notifyPostChange(pubsub, data.postId);
      res.status(201).json(result);
    }),
  );

  app.delete(
    "/mesh/comment/:id",
    withAuth(config, (req, res, auth) => {
      const id = paramId(req);
      signedBody(req, {});
      const postId = commentPostId(id);
      deleteComment(auth, id);
      if (postId !== undefined) {
        notifyPostChange(pubsub, postId);
      }
      res.json({ id, deleted: true });
    }),
  );
}
