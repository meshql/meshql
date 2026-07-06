import { describe, expect, it } from "vitest";
import { encodeQuery, signQuery } from "./sign.js";

describe("browser sign", () => {
  it("base64-encodes query without Buffer", () => {
    const headers = encodeQuery('{"post":{"id":true}}');
    expect(headers["X-Mesh-Query"]).toBeTruthy();
    expect(headers["X-Mesh-Format"]).toBe("json");
  });

  it("signs with Web Crypto HMAC", async () => {
    const headers = await signQuery('{"post":{"id":true}}', {
      secret: "test-secret",
    });
    expect(headers["X-Mesh-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
