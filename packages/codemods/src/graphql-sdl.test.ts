import { describe, expect, it } from "vitest";
import { convertGraphqlSdl } from "./graphql-sdl.js";

const SAMPLE = `
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  body: String!
  author: User!
}
`;

describe("convertGraphqlSdl", () => {
  it("maps object types to entities and relations to joins", () => {
    const { schema, report } = convertGraphqlSdl(SAMPLE);

    expect(schema.entities.user?.fields).toEqual(["id", "name", "email"]);
    expect(schema.entities.post?.fields).toEqual(["id", "title", "body"]);
    expect(schema.joins["user.posts"]).toMatchObject({
      entity: "post",
      type: "many",
    });
    expect(schema.joins["post.author"]).toMatchObject({
      entity: "user",
      type: "one",
    });
    expect(report.converted).toHaveLength(2);
    expect(report.manual.some((line) => line.includes("user.posts"))).toBe(true);
  });
});
