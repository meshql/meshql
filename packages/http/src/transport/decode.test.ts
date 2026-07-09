import { describe, expect, it } from "vitest";
import { TransportError } from "@meshql/core";
import {
  decodeQuery,
  encodePersistedQuery,
  encodeQuery,
  signPersistedQuery,
} from "./decode.js";

describe("decodeQuery", () => {
  const raw = '{"user":{"id":true}}';
  const encoded = encodeQuery(raw, "json");

  it("decodes a base64 X-Mesh-Query header", () => {
    const decoded = decodeQuery({
      headers: encoded,
    });

    expect(decoded.raw).toBe(raw);
    expect(decoded.format).toBe("json");
    expect(decoded.transport.queryHeader).toBe(encoded["X-Mesh-Query"]);
  });

  it("decodes a persisted query ID", () => {
    const id = "q_abcd1234";
    const decoded = decodeQuery(
      {
        headers: encodePersistedQuery(id, "json"),
      },
      {
        resolveQueryId: (queryId) =>
          queryId === id
            ? { raw, format: "json" }
            : undefined,
      },
    );

    expect(decoded.raw).toBe(raw);
    expect(decoded.transport.queryHeader).toBe(id);
  });

  it("rejects unknown persisted query IDs", () => {
    expect(() =>
      decodeQuery(
        {
          headers: encodePersistedQuery("q_missing", "json"),
        },
        { resolveQueryId: () => undefined },
      ),
    ).toThrow(TransportError);
  });

  it("rejects both X-Mesh-Query and X-Mesh-Query-Id", () => {
    expect(() =>
      decodeQuery({
        headers: {
          ...encoded,
          ...encodePersistedQuery("q_abcd1234", "json"),
        },
      }),
    ).toThrow("mutually exclusive");
  });

  it("signs persisted query IDs over the ID header value", () => {
    const headers = signPersistedQuery("q_abcd1234", {
      format: "json",
      secret: "test-secret",
    });

    expect(headers["X-Mesh-Query-Id"]).toBe("q_abcd1234");
    expect(headers["X-Mesh-Signature"]).toMatch(/^sha256=/);
    expect(headers["X-Mesh-Query"]).toBeUndefined();
  });
});
