import type { RenderedLeadFollowUpQueue } from "@/lib/leads/lead-follow-up.types";

export type LeadFollowUpQueueActionState = {
  status: "idle" | "success" | "permission_error" | "unavailable" | "unexpected";
  message: string;
  queue?: RenderedLeadFollowUpQueue;
};

export const initialLeadFollowUpQueueActionState: LeadFollowUpQueueActionState = {
  status: "idle",
  message: "",
};
