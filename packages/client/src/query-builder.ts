import type { MeshQuery, ReadNode, ReadSelection } from "./read-query.js";

/** Serialize a canonical query to selection-only MeshQL brace syntax. */
export function queryToQl(query: MeshQuery): string {
  const entries = Object.entries(query);
  if (entries.length !== 1) {
    throw new Error("MeshQL query must have exactly one root entity");
  }

  const [rootName, node] = entries[0]!;
  return `{ ${rootName} ${renderNode(node)} }`;
}

function renderNode(node: ReadNode): string {
  assertSelectionOnly(node);
  return renderSelection(node.$select);
}

function renderSelection(selection: ReadSelection): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(selection)) {
    parts.push(value === true ? key : `${key} ${renderNode(value)}`);
  }
  return `{ ${parts.join(" ")} }`;
}

function assertSelectionOnly(node: ReadNode): void {
  const controls = Object.keys(node).filter((key) => key !== "$select");
  if (controls.length > 0) {
    throw new Error(
      `QL format is selection-only; remove read control '${controls[0]}' or use format: 'json'`,
    );
  }
}
