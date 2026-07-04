import type { JoinPlan } from "@meshql/core";

export interface FlatRow {
  user_id: number;
  user_name: string;
  user_avatar?: string;
  tokens_accessToken?: string;
  tokens_expiresAt?: string;
}

export const inMemoryRows: FlatRow[] = [
  {
    user_id: 1,
    user_name: "Ada Lovelace",
    user_avatar: undefined,
    tokens_accessToken: "tok_ada_1",
    tokens_expiresAt: "2026-12-31",
  },
  {
    user_id: 1,
    user_name: "Ada Lovelace",
    user_avatar: undefined,
    tokens_accessToken: "tok_ada_2",
    tokens_expiresAt: "2027-01-15",
  },
  {
    user_id: 2,
    user_name: "Grace Hopper",
    user_avatar: undefined,
    tokens_accessToken: "tok_grace_1",
    tokens_expiresAt: "2026-06-30",
  },
];

export function queryInMemory(plan: JoinPlan, rows: FlatRow[]): FlatRow[] {
  let result = [...rows];

  if (plan.context.entityId !== undefined) {
    const id = Number(plan.context.entityId);
    result = result.filter((row) => row.user_id === id);
  }

  return result.map((row) => {
    const shaped: FlatRow = {
      user_id: row.user_id,
      user_name: row.user_name,
    };

    if (plan.fields.some((field) => field.endsWith(".avatar") || field === "avatar")) {
      shaped.user_avatar = row.user_avatar;
    }

    const wantsTokens = plan.joins.some((join) => join.refName === "tokens");
    if (wantsTokens) {
      shaped.tokens_accessToken = row.tokens_accessToken;
      shaped.tokens_expiresAt = row.tokens_expiresAt;
    }

    return shaped;
  });
}
