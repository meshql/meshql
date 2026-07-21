import { describe, expect, it, vi } from "vitest";
import { createGateway, type GatewayConfig } from "./gateway.js";

type FetchCall = [input: string, init?: RequestInit];

describe("createGateway", () => {
  it("routes a root entity query to the owning service", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ id: 1, name: "Ada", url }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const config: GatewayConfig = {
      schema: {
        entities: {
          user: { fields: ["id", "name"] },
        },
        joins: {},
      },
      services: [
        {
          name: "users",
          baseUrl: "http://users.test/mesh",
          entities: ["user"],
        },
      ],
    };

    const gateway = createGateway(config);
    const result = await gateway.execute('{"user":{"$select":{"id":true,"name":true}}}', {
      entityId: "1",
    });

    expect(result).toMatchObject({ id: 1, name: "Ada" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://users.test/mesh/user/1",
      expect.objectContaining({ method: "GET" }),
    );

    vi.unstubAllGlobals();
  });

  it("routes an explicit QL query", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => ({
        ok: true,
        json: async () => ({ id: 1, name: "Ada" }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const gateway = createGateway({
      schema: {
        entities: {
          user: { fields: ["id", "name"] },
        },
        joins: {},
      },
      services: [
        {
          name: "users",
          baseUrl: "http://users.test/mesh",
          entities: ["user"],
        },
      ],
    });

    const result = await gateway.execute("{ user { id name } }", {
      format: "ql",
      entityId: "1",
    });

    expect(result).toEqual({ id: 1, name: "Ada" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const qlCall = fetchMock.mock.calls[0] as FetchCall | undefined;
    const headers = new Headers(qlCall?.[1]?.headers);
    expect(headers.get("X-Mesh-Format")).toBe("ql");

    vi.unstubAllGlobals();
  });

  it("stitches cross-service joins with canonical JSON $select", async () => {
    const fetchMock = vi.fn(
      async (url: string, _init?: RequestInit) => {
        if (String(url).includes("/user/")) {
          return {
            ok: true,
            json: async () => ({ id: 1, name: "Ada" }),
          };
        }
        return {
          ok: true,
          json: async () => ({ id: 9, title: "Hello" }),
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const gateway = createGateway({
      schema: {
        entities: {
          user: { fields: ["id", "name"] },
          post: { fields: ["id", "title"] },
        },
        joins: {
          "user.posts": {
            entity: "post",
            on: "posts.author_id = users.id",
            type: "many",
          },
        },
      },
      services: [
        {
          name: "users",
          baseUrl: "http://users.test/mesh",
          entities: ["user"],
        },
        {
          name: "posts",
          baseUrl: "http://posts.test/mesh",
          entities: ["post"],
        },
      ],
    });

    const result = await gateway.execute(
      '{"user":{"$select":{"id":true,"name":true}}}',
      { entityId: "1" },
    );

    expect(result).toMatchObject({
      id: 1,
      name: "Ada",
      posts: { id: 9, title: "Hello" },
    });

    const nestedCall = (fetchMock.mock.calls as FetchCall[]).find((entry) =>
      String(entry[0]).includes("http://posts.test/mesh/post"),
    );
    expect(nestedCall).toBeDefined();
    const nestedHeaders = new Headers(nestedCall?.[1]?.headers);
    const encoded = nestedHeaders.get("X-Mesh-Query");
    expect(encoded).toBeTruthy();
    const raw = Buffer.from(encoded!, "base64").toString("utf8");
    expect(JSON.parse(raw)).toEqual({ post: { $select: { id: true } } });

    vi.unstubAllGlobals();
  });
});
