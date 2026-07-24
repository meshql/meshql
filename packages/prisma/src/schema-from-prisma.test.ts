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

  it("detects Prisma implicit many-to-many and emits through", () => {
    const schema = schemaFromPrismaSource(`
model Post {
  id   Int   @id @default(autoincrement())
  title String
  tags Tag[]

  @@map("posts")
}

model Tag {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[]

  @@map("tags")
}
`);

    expect(schema.joins["post.tags"]).toMatchObject({
      entity: "tag",
      type: "many",
      table: "tags",
      on: "_PostToTag.A = posts.id",
      through: { table: "_PostToTag", from: "A", to: "B" },
    });
    expect(schema.joins["tag.posts"]).toMatchObject({
      entity: "post",
      type: "many",
      table: "posts",
      on: "_PostToTag.B = tags.id",
      through: { table: "_PostToTag", from: "B", to: "A" },
    });
  });

  it("keeps explicit junction models as one-to-many (no through)", () => {
    const schema = schemaFromPrismaSource(`
model Post {
  id       Int       @id
  title    String
  postTags PostTag[]
}

model Tag {
  id       Int       @id
  name     String
  postTags PostTag[]
}

model PostTag {
  postId Int
  tagId  Int
  post   Post @relation(fields: [postId], references: [id])
  tag    Tag  @relation(fields: [tagId], references: [id])

  @@id([postId, tagId])
}
`);

    expect(schema.joins["post.postTags"]?.through).toBeUndefined();
    expect(schema.joins["post.postTags"]).toMatchObject({
      entity: "postTag",
      type: "many",
      on: "postTags.postId = posts.id",
    });
    expect(schema.joins["postTag.tag"]).toMatchObject({
      entity: "tag",
      type: "one",
      on: "postTags.tagId = tags.id",
    });
  });
});
