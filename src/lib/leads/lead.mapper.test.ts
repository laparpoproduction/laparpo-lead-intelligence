import { describe, expect, it } from "vitest";
import type { LeadRow } from "./lead.types";
import { mapLeadCreate, mapLeadRow, mapLeadUpdate } from "./lead.mapper";
import { validateLeadCreate } from "./lead.validation";

describe("lead mapper", () => {
  it("maps snake_case rows to the camelCase domain model", () => {
    const row: LeadRow = {
      id: "11111111-1111-4111-8111-111111111111",
      company_id: "22222222-2222-4222-8222-222222222222",
      primary_contact_id: null,
      title: "KFC Ramadan",
      stage: "new",
      lead_status: "active",
      qualification_status: "unreviewed",
      priority: "high",
      lead_score: 42,
      estimated_value: 2500,
      currency: "MYR",
      service_interest: "food_review",
      assigned_to: "33333333-3333-4333-8333-333333333333",
      created_by: "44444444-4444-4444-8444-444444444444",
      source_type: "company_website",
      source_url: "https://example.my/lead",
      source_signal_id: null,
      source_campaign: "q1-campaign",
      referral_name: null,
      discovered_at: "2026-06-01T00:00:00.000Z",
      last_verified_at: null,
      business_need: "Need content",
      budget_notes: null,
      timeline_notes: null,
      decision_maker_notes: null,
      expected_close_date: "2026-06-15",
      next_step: "Send quote",
      next_follow_up_at: "2026-06-05T00:00:00.000Z",
      last_contacted_at: null,
      notes: "A note",
      converted_at: null,
      lost_at: null,
      lost_reason: null,
      disqualified_at: null,
      disqualified_reason: null,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-02T00:00:00.000Z",
      deleted_at: null,
      fingerprint: "0123456789abcdef0123456789abcdef",
    };

    expect(mapLeadRow(row)).toMatchObject({
      id: row.id,
      companyId: row.company_id,
      title: row.title,
      stage: row.stage,
      leadStatus: row.lead_status,
      qualificationStatus: row.qualification_status,
      priority: row.priority,
      leadScore: row.lead_score,
      estimatedValue: row.estimated_value,
      serviceInterest: row.service_interest,
      nextFollowUpAt: row.next_follow_up_at,
      fingerprint: row.fingerprint,
    });
  });

  it("maps the create payload using snake_case database field names", () => {
    const input = validateLeadCreate({
      title: "KFC Ramadan",
      companyId: "22222222-2222-4222-8222-222222222222",
      sourceUrl: "https://example.my/lead",
      sourceType: "company_website",
      discoveredAt: "2026-06-01T00:00:00.000Z",
      serviceInterest: "food_review",
      sourceCampaign: "Q1 Campaign",
    });

    expect(mapLeadCreate(input, "44444444-4444-4444-8444-444444444444")).toMatchObject({
      title: "KFC Ramadan",
      company_id: "22222222-2222-4222-8222-222222222222",
      source_url: "https://example.my/lead",
      source_type: "company_website",
      discovered_at: "2026-06-01T00:00:00.000Z",
      created_by: "44444444-4444-4444-8444-444444444444",
    });
  });

  it("maps only the provided update fields", () => {
    expect(mapLeadUpdate({ title: "Updated title", stage: "qualified" })).toEqual({
      title: "Updated title",
      stage: "qualified",
    });
  });
});
