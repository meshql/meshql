import { describe, expect, it } from "vitest";
import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { schemaFromDrizzle } from "./schema-from-drizzle.js";

const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

const posts = sqliteTable("posts", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: integer("created_at"),
  authorId: integer("author_id").notNull(),
});

const comments = sqliteTable("comments", {
  id: integer("id").primaryKey(),
  body: text("body").notNull(),
  postId: integer("post_id").notNull(),
  authorId: integer("author_id").notNull(),
});

const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
}));

const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
}));

const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));

const drizzleSchema = {
  users,
  posts,
  comments,
  usersRelations,
  postsRelations,
  commentsRelations,
};

describe("schemaFromDrizzle", () => {
  it("maps tables, columns, and relations", () => {
    const schema = schemaFromDrizzle(drizzleSchema);

    expect(schema.entities.user).toMatchObject({
      fields: ["id", "name", "email"],
      table: "users",
    });
    expect(schema.entities.post).toMatchObject({
      fields: ["id", "title", "createdAt", "authorId"],
      table: "posts",
      columns: {
        createdAt: "created_at",
        authorId: "author_id",
      },
    });

    expect(schema.joins["user.posts"]).toMatchObject({
      entity: "post",
      type: "many",
      on: "posts.author_id = users.id",
    });
    expect(schema.joins["post.author"]).toMatchObject({
      entity: "user",
      type: "one",
      on: "posts.author_id = users.id",
    });
    expect(schema.joins["post.comments"]).toMatchObject({
      entity: "comment",
      type: "many",
      on: "comments.post_id = posts.id",
    });
    expect(schema.joins["comment.author"]).toMatchObject({
      entity: "user",
      type: "one",
      on: "comments.author_id = users.id",
    });
  });

  it("throws when no tables are present", () => {
    expect(() => schemaFromDrizzle({})).toThrow(/no Drizzle tables/);
  });
});
