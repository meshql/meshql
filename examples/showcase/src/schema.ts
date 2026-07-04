import type { MeshSchema } from "@meshql/core";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface Post {
  id: number;
  title: string;
  body: string;
  status: string;
  createdAt: string;
}

export interface Comment {
  id: number;
  body: string;
  createdAt: string;
}

/** Blog schema used by the MeshQL showcase. */
export const schema: MeshSchema = {
  entities: {
    user: {
      type: {} as User,
      fields: ["id", "name", "email", "role", "avatar"],
      table: "users",
    },
    post: {
      type: {} as Post,
      fields: ["id", "title", "body", "status", "createdAt"],
      table: "posts",
      columns: {
        createdAt: "created_at",
      },
    },
    comment: {
      type: {} as Comment,
      fields: ["id", "body", "createdAt"],
      table: "comments",
      columns: {
        createdAt: "created_at",
      },
    },
  },
  joins: {
    "user.posts": {
      entity: "post",
      on: "posts.author_id = users.id",
      type: "many",
      table: "posts",
    },
    "post.author": {
      entity: "user",
      on: "users.id = posts.author_id",
      type: "one",
      table: "users",
    },
    "post.comments": {
      entity: "comment",
      on: "comments.post_id = posts.id",
      type: "many",
      table: "comments",
    },
    // Nested join keys use the parent ref name from the selection
    // (`comments.author`, not `comment.author`).
    "comments.author": {
      entity: "user",
      on: "users.id = comments.author_id",
      type: "one",
      table: "users",
    },
  },
};
