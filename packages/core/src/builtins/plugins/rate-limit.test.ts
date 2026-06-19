import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit.js";
import { createQueryContext } from "../../resolver/context.js";
import { MeshError } from "../../errors/index.js";

describe("rateLimit", () => {
  it("allows requests within limit", async () => {
    const plugin = rateLimit({ window: "1m", max: 2 });

    const ctx = {
      queryContext: createQueryContext({
        requestId: "1",
        method: "GET",
        userId: `user-a-${Date.now()}`,
      }),
      startTime: Date.now(),
    };

    expect(await Promise.resolve(plugin.onRequest!("q", ctx))).toBe("q");
    expect(await Promise.resolve(plugin.onRequest!("q", ctx))).toBe("q");
  });

  it("rejects requests exceeding limit", async () => {
    const plugin = rateLimit({
      window: "1m",
      max: 1,
      key: (c) => String(c.userId),
    });

    const ctx = {
      queryContext: createQueryContext({
        requestId: "1",
        method: "GET",
        userId: `user-b-${Date.now()}`,
      }),
      startTime: Date.now(),
    };

    await Promise.resolve(plugin.onRequest!("q", ctx));

    await expect(async () => {
      await plugin.onRequest!("q", ctx);
    }).rejects.toThrow(MeshError);
  });
});
