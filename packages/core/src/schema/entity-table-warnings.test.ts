import { afterEach, describe, expect, it, vi } from "vitest";
import { warnAmbiguousEntityTables } from "./entity-table-warnings.js";
import type { MeshSchema } from "./schema.js";

describe("warnAmbiguousEntityTables", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns for irregular plurals without a table override", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    warnAmbiguousEntityTables({
      entities: {
        address: { fields: ["id"] },
        category: { fields: ["id"] },
        person: { fields: ["id"] },
      },
      joins: {},
    });

    expect(warn).toHaveBeenCalledTimes(3);
    expect(warn.mock.calls[0]?.[0]).toContain('entities.address resolves to SQL table "address"');
    expect(warn.mock.calls[0]?.[0]).toContain('entities.address.table = "addresses"');
    expect(warn.mock.calls[1]?.[0]).toContain('entities.category.table = "categories"');
    expect(warn.mock.calls[2]?.[0]).toContain('entities.person.table = "people"');
  });

  it("stays quiet when table overrides are declared", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const schema: MeshSchema = {
      entities: {
        address: { fields: ["id"], table: "addresses" },
        user: { fields: ["id"] },
      },
      joins: {},
    };

    warnAmbiguousEntityTables(schema);

    expect(warn).not.toHaveBeenCalled();
  });

  it("stays quiet for regular pluralization", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    warnAmbiguousEntityTables({
      entities: {
        user: { fields: ["id"] },
        post: { fields: ["id"] },
      },
      joins: {},
    });

    expect(warn).not.toHaveBeenCalled();
  });
});
