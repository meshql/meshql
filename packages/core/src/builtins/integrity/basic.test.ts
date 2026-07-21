import { describe, expect, it } from "vitest";
import { basicIntegrityPlugin } from "./basic.js";
import { signQueryHeader } from "../../crypto/hmac.js";
import { IntegrityError } from "../../errors/index.js";
import { createQueryContext } from "../../resolver/context.js";

describe("basicIntegrityPlugin", () => {
  const secret = "test-secret";
  const queryHeader = Buffer.from('{"user":{"$select":{"id":true}}}', "utf8").toString("base64");

  it("accepts a valid signature", async () => {
    const plugin = basicIntegrityPlugin({ secret });
    const signature = signQueryHeader(secret, queryHeader);

    const raw = await plugin.onRequest!("query", {
      queryContext: createQueryContext({ requestId: "1", method: "GET" }),
      transport: { queryHeader, signature },
      startTime: Date.now(),
    });

    expect(raw).toBe("query");
  });

  it("rejects missing signature", async () => {
    const plugin = basicIntegrityPlugin({ secret });

    await expect(async () => {
      await plugin.onRequest!("query", {
        queryContext: createQueryContext({ requestId: "1", method: "GET" }),
        transport: { queryHeader },
        startTime: Date.now(),
      });
    }).rejects.toThrow(IntegrityError);
  });

  it("rejects invalid signature", async () => {
    const plugin = basicIntegrityPlugin({ secret });

    await expect(async () => {
      await plugin.onRequest!("query", {
        queryContext: createQueryContext({ requestId: "1", method: "GET" }),
        transport: { queryHeader, signature: "sha256=bad" },
        startTime: Date.now(),
      });
    }).rejects.toThrow("Signature verification failed");
  });
});
