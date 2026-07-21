import { ParseError } from "../errors/index.js";
import {
  AGGREGATE_FNS,
  COMPARISON_OPS,
  type AggregateFn,
  type AggregateSpec,
  type ComparisonOp,
  type HavingExpr,
  type PageInput,
  type QueryDocument,
  type ReadNodeWire,
  type SortExpr,
  type WhereExpr,
} from "./types.js";

const RESERVED_KEYS = new Set([
  "$select",
  "$where",
  "$orderBy",
  "$page",
  "$distinct",
  "$groupBy",
  "$aggregate",
  "$having",
]);

function isComparisonOp(value: string): value is ComparisonOp {
  return (COMPARISON_OPS as readonly string[]).includes(value);
}

function isAggregateFn(value: string): value is AggregateFn {
  return (AGGREGATE_FNS as readonly string[]).includes(value);
}

/** Parse a JSON query document using the current MeshQL read protocol. */
export function parseJsonQuery(raw: string): QueryDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ParseError("Invalid JSON query");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ParseError("Query must be a JSON object");
  }

  const entries = Object.entries(parsed as Record<string, unknown>).filter(
    ([key]) => !key.startsWith("$"),
  );

  if (entries.length !== 1) {
    throw new ParseError("Query must have exactly one root entity");
  }

  const [rootName, rootValue] = entries[0]!;
  return {
    version: 2,
    root: parseReadNode(rootName, rootValue),
  };
}

function parseReadNode(name: string, value: unknown): ReadNodeWire {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ParseError(`Entity '${name}' must be an object`);
  }

  const obj = value as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") && !RESERVED_KEYS.has(key)) {
      throw new ParseError(`Unknown control '${key}' on '${name}'`);
    }
  }

  // `$select` is optional: when present it is the canonical selection map;
  // otherwise the node's own non-`$` keys form the selection.
  const selectRaw =
    "$select" in obj
      ? obj.$select
      : Object.fromEntries(
          Object.entries(obj).filter(([key]) => !key.startsWith("$")),
        );

  if (!selectRaw || typeof selectRaw !== "object" || Array.isArray(selectRaw)) {
    throw new ParseError(`Entity '${name}' '$select' must be an object`);
  }

  const selectMap = selectRaw as Record<string, unknown>;
  if (Object.keys(selectMap).length === 0) {
    throw new ParseError(`Entity '${name}' must select at least one field`);
  }

  const node: ReadNodeWire = {
    name,
    select: parseSelectMap(name, selectMap),
  };

  if ("$where" in obj) node.where = parseWhere(obj.$where, `$where on '${name}'`);
  if ("$orderBy" in obj) node.orderBy = parseOrderBy(obj.$orderBy, name);
  if ("$page" in obj) node.page = parsePage(obj.$page, name);
  if ("$distinct" in obj) node.distinct = parseStringArray(obj.$distinct, `$distinct on '${name}'`);
  if ("$groupBy" in obj) node.groupBy = parseStringArray(obj.$groupBy, `$groupBy on '${name}'`);
  if ("$aggregate" in obj) node.aggregates = parseAggregates(obj.$aggregate, name);
  if ("$having" in obj) node.having = parseHaving(obj.$having, `$having on '${name}'`);

  return node;
}

function parseSelectMap(
  parentName: string,
  value: Record<string, unknown>,
): Record<string, boolean | ReadNodeWire> {
  const out: Record<string, boolean | ReadNodeWire> = {};
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key.startsWith("$")) {
      throw new ParseError(`Unknown key '${key}' in '${parentName}.$select'`);
    }
    if (fieldValue === true) {
      out[key] = true;
    } else if (fieldValue && typeof fieldValue === "object" && !Array.isArray(fieldValue)) {
      out[key] = parseReadNode(key, fieldValue);
    } else {
      throw new ParseError(`Invalid selection for '${parentName}.${key}'`);
    }
  }
  return out;
}

function parseWhere(raw: unknown, label: string): WhereExpr {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`${label} must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  if ("and" in obj) {
    if (!Array.isArray(obj.and)) throw new ParseError(`${label}.and must be an array`);
    return { and: obj.and.map((entry, i) => parseWhere(entry, `${label}.and[${i}]`)) };
  }
  if ("or" in obj) {
    if (!Array.isArray(obj.or)) throw new ParseError(`${label}.or must be an array`);
    return { or: obj.or.map((entry, i) => parseWhere(entry, `${label}.or[${i}]`)) };
  }
  if ("not" in obj) {
    return { not: parseWhere(obj.not, `${label}.not`) };
  }
  const field = obj.field;
  const op = obj.op;
  if (typeof field !== "string" || field.length === 0) {
    throw new ParseError(`${label}.field must be a non-empty string`);
  }
  if (typeof op !== "string" || !isComparisonOp(op)) {
    throw new ParseError(`${label}.op must be a supported operator`);
  }
  if (op === "isNull" || op === "isNotNull") {
    return { field, op };
  }
  if (!("value" in obj)) {
    throw new ParseError(`${label}.value is required for operator '${op}'`);
  }
  return { field, op, value: obj.value as WhereExpr extends { value?: infer V } ? V : never };
}

function parseHaving(raw: unknown, label: string): HavingExpr {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`${label} must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  if ("and" in obj) {
    if (!Array.isArray(obj.and)) throw new ParseError(`${label}.and must be an array`);
    return { and: obj.and.map((entry, i) => parseHaving(entry, `${label}.and[${i}]`)) };
  }
  if ("or" in obj) {
    if (!Array.isArray(obj.or)) throw new ParseError(`${label}.or must be an array`);
    return { or: obj.or.map((entry, i) => parseHaving(entry, `${label}.or[${i}]`)) };
  }
  if ("not" in obj) {
    return { not: parseHaving(obj.not, `${label}.not`) };
  }
  if ("aggregate" in obj) {
    const aggregate = obj.aggregate;
    const op = obj.op;
    if (typeof aggregate !== "string" || aggregate.length === 0) {
      throw new ParseError(`${label}.aggregate must be a non-empty string`);
    }
    if (typeof op !== "string" || !isComparisonOp(op)) {
      throw new ParseError(`${label}.op must be a supported operator`);
    }
    if (op === "isNull" || op === "isNotNull") {
      return { aggregate, op };
    }
    if (!("value" in obj)) {
      throw new ParseError(`${label}.value is required for operator '${op}'`);
    }
    return {
      aggregate,
      op,
      value: obj.value as HavingExpr extends { value?: infer V } ? V : never,
    };
  }
  const field = obj.field;
  const op = obj.op;
  if (typeof field !== "string" || field.length === 0) {
    throw new ParseError(`${label}.field must be a non-empty string`);
  }
  if (typeof op !== "string" || !isComparisonOp(op)) {
    throw new ParseError(`${label}.op must be a supported operator`);
  }
  if (op === "isNull" || op === "isNotNull") {
    return { field, op };
  }
  if (!("value" in obj)) {
    throw new ParseError(`${label}.value is required for operator '${op}'`);
  }
  return { field, op, value: obj.value as HavingExpr extends { value?: infer V } ? V : never };
}

function parseOrderBy(raw: unknown, entityName: string): SortExpr[] {
  if (!Array.isArray(raw)) {
    throw new ParseError(`'$orderBy' on '${entityName}' must be an array`);
  }
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new ParseError(`'$orderBy[${index}]' on '${entityName}' must be an object`);
    }
    const obj = entry as Record<string, unknown>;
    const direction = obj.direction;
    if (direction !== "asc" && direction !== "desc") {
      throw new ParseError(`'$orderBy[${index}].direction' must be 'asc' or 'desc'`);
    }
    const nulls = obj.nulls;
    if (nulls !== undefined && nulls !== "first" && nulls !== "last") {
      throw new ParseError(`'$orderBy[${index}].nulls' must be 'first' or 'last'`);
    }
    if ("aggregate" in obj) {
      const aggregate = obj.aggregate;
      if (typeof aggregate !== "string" || aggregate.length === 0) {
        throw new ParseError(`'$orderBy[${index}].aggregate' must be a non-empty string`);
      }
      return {
        aggregate,
        direction,
        ...(nulls ? { nulls } : {}),
      };
    }
    const field = obj.field;
    if (typeof field !== "string" || field.length === 0) {
      throw new ParseError(`'$orderBy[${index}].field' must be a non-empty string`);
    }
    return {
      field,
      direction,
      ...(nulls ? { nulls } : {}),
    };
  });
}

function parsePage(raw: unknown, entityName: string): PageInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`'$page' on '${entityName}' must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const out: PageInput = {};
  if ("first" in obj) {
    const first = obj.first;
    if (typeof first !== "number" || !Number.isInteger(first) || first < 1) {
      throw new ParseError(`'$page.first' on '${entityName}' must be a positive integer`);
    }
    out.first = first;
  }
  if ("after" in obj) {
    const after = obj.after;
    if (after !== null && (typeof after !== "string" || after.length === 0)) {
      throw new ParseError(`'$page.after' on '${entityName}' must be a non-empty string or null`);
    }
    out.after = after;
  }
  return out;
}

function parseStringArray(raw: unknown, label: string): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new ParseError(`${label} must be a non-empty array`);
  }
  return raw.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new ParseError(`${label}[${index}] must be a non-empty string`);
    }
    return entry;
  });
}

function parseAggregates(
  raw: unknown,
  entityName: string,
): Record<string, AggregateSpec> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`'$aggregate' on '${entityName}' must be an object`);
  }
  const out: Record<string, AggregateSpec> = {};
  for (const [alias, specRaw] of Object.entries(raw as Record<string, unknown>)) {
    if (!specRaw || typeof specRaw !== "object" || Array.isArray(specRaw)) {
      throw new ParseError(`'$aggregate.${alias}' on '${entityName}' must be an object`);
    }
    const spec = specRaw as Record<string, unknown>;
    const fn = spec.fn;
    if (typeof fn !== "string" || !isAggregateFn(fn)) {
      throw new ParseError(`'$aggregate.${alias}.fn' must be a supported aggregate`);
    }
    const field = spec.field;
    if (field !== undefined && field !== "*" && typeof field !== "string") {
      throw new ParseError(`'$aggregate.${alias}.field' must be a string or '*'` );
    }
    out[alias] = {
      fn,
      ...(field !== undefined ? { field } : {}),
      ...(spec.distinct === true ? { distinct: true } : {}),
    };
  }
  return out;
}
