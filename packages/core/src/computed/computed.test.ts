import { describe, expect, it } from "vitest";
import { createMesh } from "../index.js";
import { parseQl } from "../parser/index.js";
import { normalizeReadTree } from "../query/index.js";
import { buildJoinPlan } from "../planner/join-plan.js";
import { stripFieldsFromPlan } from "../planner/strip-fields.js";
import { validateAst } from "../planner/validator.js";
import { createQueryContext } from "../resolver/context.js";
import { validateComputedFields } from "../schema/validate-computed.js";
import type { MeshSchema } from "../schema/schema.js";
import { ValidationError } from "../errors/index.js";

const schema: MeshSchema = {
  entities: {
    user: {
      fields: ["id", "firstName", "lastName", "email"],
      table: "users",
      computed: {
        fullName: {
          from: ["firstName", "lastName"],
          compute: (deps) =>
            `${deps.firstName ?? ""} ${deps.lastName ?? ""}`.trim(),
          type: "string",
        },
        display: {
          from: ["customer.firstName"],
          compute: (deps) => `via ${deps["customer.firstName"]}`,
        },
      },
    },
    customer: {
      fields: ["id", "firstName"],
      table: "customers",
    },
  },
  joins: {
    "user.customer": {
      entity: "customer",
      on: "customers.id = users.customer_id",
      type: "one",
    },
  },
};

describe("validateComputedFields", () => {
  it("rejects overlapping physical + computed names", () => {
    expect(() =>
      validateComputedFields({
        entities: {
          user: {
            fields: ["id", "fullName"],
            computed: {
              fullName: {
                from: ["id"],
                compute: () => "x",
              },
            },
          },
        },
        joins: {},
      }),
    ).toThrow(/conflicts with physical field/);
  });

  it("rejects computed depending on computed", () => {
    expect(() =>
      validateComputedFields({
        entities: {
          user: {
            fields: ["id", "firstName"],
            computed: {
              a: { from: ["firstName"], compute: () => 1 },
              b: { from: ["a"], compute: () => 2 },
            },
          },
        },
        joins: {},
      }),
    ).toThrow(/cannot depend on computed field/);
  });

  it("accepts a valid schema", () => {
    expect(() => validateComputedFields(schema)).not.toThrow();
  });
});

describe("computed planner", () => {
  it("expands same-entity deps and excludes computed from SQL fields", () => {
    const ast = parseQl("{ user { fullName } }");
    validateAst(ast, schema);
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.fields).toEqual(
      expect.arrayContaining(["users.id", "users.firstName", "users.lastName"]),
    );
    expect(plan.fields).not.toContain("users.fullName");
    expect(plan.computedFields).toHaveLength(1);
    expect(plan.computedFields?.[0]?.name).toBe("fullName");
  });

  it("auto-joins for cross-entity deps", () => {
    const ast = parseQl("{ user { display } }");
    validateAst(ast, schema);
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    expect(plan.joins.map((j) => j.path)).toContain("customer");
    expect(plan.fields).toEqual(
      expect.arrayContaining(["customer.id", "customer.firstName"]),
    );
    expect(plan.computedFields?.[0]?.name).toBe("display");
  });

  it("rejects computed fields in a $where filter", () => {
    const build = () =>
      normalizeReadTree(
        {
          name: "user",
          select: { id: true },
          where: { field: "fullName", op: "eq", value: "Ada" },
        },
        schema,
      );
    expect(build).toThrow(ValidationError);
    expect(build).toThrow(/Computed field 'fullName' cannot be used in filters/);
  });
});

describe("computed stripFieldsFromPlan", () => {
  it("strips denied computed and unrequested deps", () => {
    const ast = parseQl("{ user { fullName } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    const stripped = stripFieldsFromPlan(plan, ["user.fullName"], schema);
    expect(stripped.computedFields).toBeUndefined();
    expect(stripped.fields).not.toContain("users.firstName");
    expect(stripped.fields).not.toContain("users.lastName");
    expect(stripped.fields).toContain("users.id");
  });

  it("keeps explicitly requested deps when computed is denied", () => {
    const ast = parseQl("{ user { fullName firstName } }");
    const plan = buildJoinPlan(
      ast,
      schema,
      createQueryContext({ requestId: "1", method: "GET" }),
    );

    const stripped = stripFieldsFromPlan(plan, ["user.fullName"], schema);
    expect(stripped.computedFields).toBeUndefined();
    expect(stripped.fields).toContain("users.firstName");
    expect(stripped.fields).not.toContain("users.lastName");
  });
});

describe("computed execute", () => {
  it("computes flat-row results and hides unrequested deps", async () => {
    const mesh = createMesh(schema);
    mesh.resolve("user", async () => [
      {
        user_id: 1,
        user_firstName: "Ada",
        user_lastName: "Lovelace",
      },
    ]);

    const data = await mesh.execute(
      JSON.stringify({ user: { fullName: true } }),
      { format: "json", list: false },
    );

    expect(data).toEqual({ fullName: "Ada Lovelace" });
  });

  it("keeps explicitly requested source fields", async () => {
    const mesh = createMesh(schema);
    mesh.resolve("user", async () => [
      {
        user_id: 1,
        user_firstName: "Ada",
        user_lastName: "Lovelace",
      },
    ]);

    const data = await mesh.execute(
      JSON.stringify({ user: { fullName: true, firstName: true } }),
      { format: "json", list: false },
    );

    expect(data).toEqual({ fullName: "Ada Lovelace", firstName: "Ada" });
  });

  it("applies computed on the preshaped path", async () => {
    const mesh = createMesh(schema);
    mesh.resolve(
      "user",
      async () => ({
        id: 1,
        firstName: "Ada",
        lastName: "Lovelace",
      }),
      { preshaped: true },
    );

    const data = await mesh.execute(
      JSON.stringify({ user: { fullName: true } }),
      { format: "json", list: false },
    );

    expect(data).toEqual({ fullName: "Ada Lovelace" });
  });
});
