import type { DateBucket, GroupByKey } from "./types.js";

/** Source field of a group key. */
export function groupKeyField(key: GroupByKey): string {
  return typeof key === "string" ? key : key.field;
}

/** Response name of a group key (`as`, falling back to the field). */
export function groupKeyAlias(key: GroupByKey): string {
  return typeof key === "string" ? key : (key.as ?? key.field);
}

/** Date bucket of a group key, if any. */
export function groupKeyBucket(key: GroupByKey): DateBucket | undefined {
  return typeof key === "string" ? undefined : key.bucket;
}
