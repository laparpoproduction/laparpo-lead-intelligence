import { describe, expect, it } from "vitest";
import {
  canInspectArchivedLeadActivities,
  canModifyLeadActivity,
  followUpState,
  humanizeActivityType,
  parseActivityPage,
} from "./lead-activity-ui";
import type {
  LeadActivity,
  LeadActivityActor,
} from "./lead-activity.types";

const actor: LeadActivityActor = {
  userId: "11111111-1111-4111-8111-111111111111",
  role: "sales_representative",
  isActive: true,
};
const activity: LeadActivity = {
  id: "22222222-2222-4222-8222-222222222222",
  leadId: "33333333-3333-4333-8333-333333333333",
  activityType: "follow_up",
  subject: "Send proposal",
  description: null,
  activityAt: "2026-07-24T08:00:00.000Z",
  nextFollowUpAt: "2026-07-25T08:00:00.000Z",
  outcome: null,
  createdBy: actor.userId,
  assignedTo: null,
  createdAt: "2026-07-24T08:00:00.000Z",
  updatedAt: "2026-07-24T08:00:00.000Z",
  deletedAt: null,
};

describe("Lead activity UI policy", () => {
  it("humanizes types and derives follow-up visibility from server time", () => {
    expect(humanizeActivityType("status_change")).toBe("Status Change");
    expect(
      followUpState(activity.nextFollowUpAt, "2026-07-26T00:00:00.000Z"),
    ).toBe("overdue");
    expect(
      followUpState(activity.nextFollowUpAt, "2026-07-24T00:00:00.000Z"),
    ).toBe("upcoming");
    expect(followUpState(null, "2026-07-24T00:00:00.000Z")).toBeNull();
  });

  it("uses activity ownership only for control visibility, not authorization", () => {
    expect(canModifyLeadActivity(activity, actor, true)).toBe(true);
    expect(
      canModifyLeadActivity(
        {
          ...activity,
          createdBy: "44444444-4444-4444-8444-444444444444",
        },
        actor,
        true,
      ),
    ).toBe(false);
    expect(canModifyLeadActivity(activity, actor, false)).toBe(false);
    expect(
      canModifyLeadActivity(
        activity,
        { ...actor, role: "sales_manager" },
        true,
      ),
    ).toBe(true);
    expect(canInspectArchivedLeadActivities(actor)).toBe(false);
  });

  it("normalizes invalid pagination without trusting query input", () => {
    expect(parseActivityPage("3")).toBe(3);
    expect(parseActivityPage("-1")).toBe(1);
    expect(parseActivityPage("1.5")).toBe(1);
    expect(parseActivityPage(["2", "3"])).toBe(2);
  });
});
