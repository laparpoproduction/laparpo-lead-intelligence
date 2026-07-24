import type {
  LeadActivity,
  LeadActivityActor,
  LeadActivityType,
} from "./lead-activity.types";

export const LEAD_ACTIVITY_PAGE_SIZE = 25;

export type FollowUpState = "overdue" | "upcoming" | null;

export function humanizeActivityType(value: LeadActivityType): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
export function canCreateLeadActivity(canModifyLead: boolean): boolean {
  return canModifyLead;
}

export function canModifyLeadActivity(
  activity: LeadActivity,
  actor: LeadActivityActor,
  canModifyLead: boolean,
): boolean {
  if (!canModifyLead) return false;
  if (actor.role === "ceo_admin" || actor.role === "sales_manager") return true;
  return (
    activity.createdBy === actor.userId ||
    activity.assignedTo === actor.userId
  );
}

export function canInspectArchivedLeadActivities(
  actor: LeadActivityActor,
): boolean {
  return actor.role === "ceo_admin" || actor.role === "sales_manager";
}

export function followUpState(
  nextFollowUpAt: string | null,
  nowIso: string,
): FollowUpState {
  if (!nextFollowUpAt) return null;
  return Date.parse(nextFollowUpAt) < Date.parse(nowIso)
    ? "overdue"
    : "upcoming";
}

export function parseActivityPage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) return 1;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : 1;
}
