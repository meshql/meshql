import { describe, expect, it } from "vitest";
import {
  deriveSigningToken,
  formatWireToken,
  parseWireToken,
  isTokenExpired,
  parseTtl,
} from "./token.js";
import { issueToken, withIntegrity } from "./plugin.js";
import { InMemoryTokenStore } from "./store.js";
import { createMesh } from "@meshql/core";
import { signQueryHeader } from "@meshql/core";

describe("token", () => {
  it("derives consistent signing tokens", () => {
    const a = deriveSigningToken("secret", "u1", "s1", 1000);
    const b = deriveSigningToken("secret", "u1", "s1", 1000);
    expect(a).toBe(b);
    expect(a).not.toBe(deriveSigningToken("secret", "u2", "s1", 1000));
  });

  it("round-trips wire tokens", () => {
    const payload = {
      userId: "u1",
      sessionId: "s1",
      expiresAt: Date.now() + 60_000,
      role: "admin",
    };
    const token = formatWireToken(payload);
    expect(token.startsWith("tok_")).toBe(true);
    expect(parseWireToken(token)).toEqual(payload);
  });

  it("detects expiry", () => {
    expect(isTokenExpired(Date.now() - 1)).toBe(true);
    expect(isTokenExpired(Date.now() + 60_000)).toBe(false);
  });

  it("parses TTL strings", () => {
    expect(parseTtl("15m")).toBe(15 * 60 * 1000);
    expect(parseTtl("1h")).toBe(60 * 60 * 1000);
  });
});

describe("issueToken", () => {
  it("issues and stores a session", () => {
    const store = new InMemoryTokenStore();
    const config = {
      secret: "master",
      tokenTTL: "15m",
      store,
      authenticate: async () => ({
        userId: "u1",
        sessionId: "s1",
        role: "user",
      }),
    };

    const result = issueToken(config, {
      userId: "u1",
      sessionId: "s1",
      role: "user",
    });

    expect(result.signingToken).toBeTruthy();
    expect(result.token.startsWith("tok_")).toBe(true);
    expect(store.get("s1")?.signingToken).toBe(result.signingToken);
  });
});

describe("withIntegrity", () => {
  it("verifies signed requests", async () => {
    const mesh = createMesh({
      entities: { user: { fields: ["id"] } },
      joins: {},
    });

    const secured = withIntegrity(mesh, {
      secret: "master",
      tokenTTL: "15m",
      authenticate: async () => ({
        userId: "u1",
        sessionId: "s1",
      }),
    });

    const { signingToken, token } = issueToken(secured.integrity, {
      userId: "u1",
      sessionId: "s1",
    });

    mesh.resolve("user", async (plan) => {
      expect(plan.context.userId).toBe("u1");
      return { id: "1" };
    });

    const queryHeader = Buffer.from('{"user":{"$select":{"id":true}}}', "utf8").toString("base64");
    const signature = signQueryHeader(signingToken, queryHeader);

    const result = await mesh.execute('{"user":{"$select":{"id":true}}}', {
      format: "json",
      list: false,
      transport: { queryHeader, signature, token },
      context: { requestId: "1", method: "GET" },
    });

    expect(result).toEqual({ id: "1" });
  });
});
