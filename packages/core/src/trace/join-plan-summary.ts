import type { JoinPlan } from "../planner/join-plan.js";

/** Slim join-plan view for execute metadata and docs responses. */
export interface JoinPlanSummary {
  rootEntity: string;
  fields: string[];
  joins: Array<{
    path: string;
    entity: string;
    type: "one" | "many";
    fields: string[];
  }>;
  list: boolean;
}

/** Build a JSON-safe plan summary from a full join plan. */
export function summarizeJoinPlan(plan: JoinPlan): JoinPlanSummary {
  return {
    rootEntity: plan.rootEntity,
    fields: [...plan.fields],
    joins: plan.joins.map((join) => ({
      path: join.path,
      entity: join.entity,
      type: join.type,
      fields: [...join.fields],
    })),
    list: plan.list !== undefined,
  };
}
