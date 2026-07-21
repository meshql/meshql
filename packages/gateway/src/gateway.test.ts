import { describe, expect, it, vi } from "vitest";
import { createGateway, type GatewayConfig } from "./gateway.js";

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
    const result = await gateway.execute('{"user":{"id":true,"name":true}}', {
      entityId: "1",
    });

    expect(result).toMatchObject({ id: 1, name: "Ada" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://users.test/mesh/user/1",
      expect.objectContaining({ method: "GET" }),
    );

    vi.unstubAllGlobals();
  });
});
