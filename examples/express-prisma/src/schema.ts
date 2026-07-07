import type { MeshSchema } from "@meshql/core";

export const schema: MeshSchema = {
  entities: {
    user: {
      type: {},
      fields: ["id", "name", "email", "role"],
      table: "users",
    },
    post: {
      type: {},
      fields: ["id", "title", "body", "status", "createdAt"],
      table: "posts",
      columns: { createdAt: "created_at" },
    },
    comment: {
      type: {},
      fields: ["id", "body", "createdAt"],
      table: "comments",
      columns: { createdAt: "created_at" },
    },
  },
  joins: {
    "user.posts": {
      entity: "post",
      on: "posts.author_id = users.id",
      type: "many",
    },
    "post.author": {
      entity: "user",
      on: "users.id = posts.author_id",
      type: "one",
    },
    "post.comments": {
      entity: "comment",
      on: "comments.post_id = posts.id",
      type: "many",
    },
    "comments.author": {
      entity: "user",
      on: "users.id = comments.author_id",
      type: "one",
    },
  },
};
