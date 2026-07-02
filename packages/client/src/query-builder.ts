import type { ListOptions } from "@meshql/core";

/** Nested JSON field selection used by the MeshQL client. */
export type QuerySelection = {
  [key: string]: boolean | QuerySelection;
};

/**
 * Serialize a field selection to JSON query format.
 *
 * When `list` is provided it lands in the payload under the reserved
 * `$list` key so the server picks it up as part of the signed body. The
 * key sits alongside the entity selection \u2014 do not include a `$list`
 * property in `selection` itself.
 */
export function selectionToJson(selection: QuerySelection, list?: ListOptions): string {
  if (list === undefined) {
    return JSON.stringify(selection);
  }
  return JSON.stringify({ ...selection, $list: list });
}

/** Serialize a field selection to MeshQL brace syntax. */
export function selectionToQl(selection: QuerySelection, rootName?: string): string {
  const entries = Object.entries(selection);
  if (entries.length !== 1) {
    throw new Error("Query selection must have exactly one root entity");
  }

  const [name, value] = entries[0]!;
  const entityName = rootName ?? name;
  return `{ ${entityName} ${renderNode(value)} }`;
}

function renderNode(value: boolean | QuerySelection): string {
  if (value === true) {
    return "";
  }

  const parts: string[] = [];
  for (const [key, fieldValue] of Object.entries(value)) {
    if (fieldValue === true) {
      parts.push(key);
    } else {
      parts.push(`${key} ${renderNode(fieldValue)}`);
    }
  }

  return `{ ${parts.join(" ")} }`;
}
