import type { Lead, LeadActor } from "./lead.types";

export const LEADS_DEFAULT_PAGE_SIZE = 25;

export function isLeadManagement(actor: LeadActor): boolean {
  return actor.role === "ceo_admin" || actor.role === "sales_manager";
}
export function canEditLead(lead: Lead, actor: LeadActor): boolean {
  return isLeadManagement(actor)
    || lead.createdBy === actor.userId
    || lead.assignedTo === actor.userId;
}

export function canArchiveLead(actor: LeadActor): boolean {
  return isLeadManagement(actor);
}

export function humanizeLeadValue(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
