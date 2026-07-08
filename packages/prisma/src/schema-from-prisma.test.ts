import { describe, expect, it } from "vitest";
import { schemaFromPrismaSource } from "./schema-from-prisma.js";

const blog = `
model User {
  id       Int       @id @default(autoincrement())
  name     String
  email    String    @unique
  role     String    @default("guest")
  posts    Post[]
  comments Comment[]

  @@map("users")
}

model Post {
  id        Int       @id @default(autoincrement())
  title     String
  body      String
  status    String    @default("draft")
  createdAt DateTime  @default(now()) @map("created_at")
  authorId  Int       @map("author_id")
  author    User      @relation(fields: [authorId], references: [id])
  comments  Comment[]

  @@map("posts")
}

model Comment {
  id        Int      @id @default(autoincrement())
  body      String
  createdAt DateTime @default(now()) @map("created_at")
  postId    Int      @map("post_id")
  authorId  Int      @map("author_id")
  post      Post     @relation(fields: [postId], references: [id])
  author    User     @relation(fields: [authorId], references: [id])

  @@map("comments")
}
`;

describe("schemaFromPrismaSource", () => {
  it("maps models, scalars, @@map, @map, and relations", () => {
    const schema = schemaFromPrismaSource(blog);

    expect(schema.entities.user).toMatchObject({
      fields: ["id", "name", "email", "role"],
      table: "users",
    });
    expect(schema.entities.post).toMatchObject({
      fields: ["id", "title", "body", "status", "createdAt", "authorId"],
      table: "posts",
      columns: {
        createdAt: "created_at",
        authorId: "author_id",
      },
    });
    expect(schema.entities.comment!.table).toBe("comments");

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

  it("sets idField when @id is not named id", () => {
    const schema = schemaFromPrismaSource(`
model Account {
  uuid String @id
  name String
}
`);
    expect(schema.entities.account!.idField).toBe("uuid");
    expect(schema.entities.account!.fields).toEqual(["uuid", "name"]);
  });
});
