import { describe, expect, it } from "vitest";
import {
  validateLeadActivityCreate,
  validateLeadActivityListOptions,
  validateLeadActivityUpdate,
} from "./lead-activity.validation";

const leadId = "11111111-1111-4111-8111-111111111111";

describe("Lead activity validation", () => {
  it("validates create input and supplies an activity timestamp", () => {
    const parsed = validateLeadActivityCreate({
      leadId,
      activityType: "note",
      description: "Discovery context",
    });
    expect(parsed.activityAt).toMatch(/Z$/);
  });

  it("accepts every supported activity type", () => {
    for (const activityType of [
      "call",
      "meeting",
      "note",
      "email",
      "whatsapp",
      "follow_up",
      "quotation",
      "deposit",
      "status_change",
    ] as const) {
      expect(
        validateLeadActivityCreate({ leadId, activityType }).activityType,
      ).toBe(activityType);
    }
  });

  it("rejects arbitrary activity types, malformed UUIDs, and timestamps", () => {
    expect(() =>
      validateLeadActivityCreate({
        leadId,
        activityType: "sms" as "call",
      }),
    ).toThrow();
    expect(() =>
      validateLeadActivityCreate({
        leadId: "not-a-uuid",
        activityType: "call",
      }),
    ).toThrow();
    expect(() =>
      validateLeadActivityCreate({
        leadId,
        activityType: "call",
        activityAt: "tomorrow",
      }),
    ).toThrow();
  });

  it("enforces text lengths without requiring filler subjects", () => {
    expect(
      validateLeadActivityCreate({ leadId, activityType: "note" }).subject,
    ).toBeUndefined();
    expect(() =>
      validateLeadActivityCreate({
        leadId,
        activityType: "note",
        subject: "x".repeat(241),
      }),
    ).toThrow();
    expect(() =>
      validateLeadActivityCreate({
        leadId,
        activityType: "note",
        description: "x".repeat(10_001),
      }),
    ).toThrow();
  });

  it("requires at least one update field", () => {
    expect(() => validateLeadActivityUpdate({})).toThrow();
    expect(
      validateLeadActivityUpdate({ nextFollowUpAt: null }),
    ).toEqual({ nextFollowUpAt: null });
  });

  it("validates list defaults, filters, and ranges", () => {
    expect(validateLeadActivityListOptions()).toMatchObject({
      page: 1,
      pageSize: 25,
      sortDirection: "desc",
    });
    expect(() =>
      validateLeadActivityListOptions({
        fromActivityAt: "2026-08-02T00:00:00.000Z",
        toActivityAt: "2026-08-01T00:00:00.000Z",
      }),
    ).toThrow();
    expect(() =>
      validateLeadActivityListOptions({ assignedTo: "not-a-uuid" }),
    ).toThrow();
  });
});
