import { describe, expect, it } from "vitest";
import {
  mapLeadActivityCreate,
  mapLeadActivityRow,
  mapLeadActivityUpdate,
} from "./lead-activity.mapper";
import { validateLeadActivityCreate } from "./lead-activity.validation";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  lead_id: "22222222-2222-4222-8222-222222222222",
  activity_type: "call",
  subject: "Discovery call",
  description: "Discussed campaign",
  activity_at: "2026-07-24T01:00:00.000Z",
  next_follow_up_at: "2026-07-25T01:00:00.000Z",
  outcome: "Send proposal",
  created_by: "33333333-3333-4333-8333-333333333333",
  assigned_to: null,
  created_at: "2026-07-24T01:01:00.000Z",
  updated_at: "2026-07-24T01:01:00.000Z",
  deleted_at: null,
} as const;

describe("Lead activity mapper", () => {
  it("maps database rows into domain objects", () => {
    expect(mapLeadActivityRow(row)).toMatchObject({
      leadId: row.lead_id,
      activityType: "call",
      createdBy: row.created_by,
      nextFollowUpAt: row.next_follow_up_at,
    });
  });

  it("binds created_by when mapping inserts", () => {
    const input = validateLeadActivityCreate({
      leadId: row.lead_id,
      activityType: "note",
      activityAt: row.activity_at,
    });
    expect(mapLeadActivityCreate(input, row.created_by)).toMatchObject({
      lead_id: row.lead_id,
      created_by: row.created_by,
      subject: null,
    });
  });

  it("maps only supplied update fields", () => {
    expect(
      mapLeadActivityUpdate({
        outcome: "Qualified",
        nextFollowUpAt: null,
      }),
    ).toEqual({
      outcome: "Qualified",
      next_follow_up_at: null,
    });
  });
});
