import { describe, expect, it } from "vitest";
import {
  deriveLeadFollowUpOverview,
  isLeadFollowUpBaseEligible,
  leadFollowUpAttentionCodesFor,
  projectLeadFollowUpQueue,
} from "./lead-follow-up.projection";
import type {
  LeadFollowUpPriorityReadModel,
  LeadFollowUpReadRow,
} from "./lead-follow-up.types";

const now = new Date("2026-08-10T00:00:00.000Z");

function row(
  overrides: Partial<LeadFollowUpReadRow> = {},
): LeadFollowUpReadRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    title: "Unicode 食品 Café",
    stage: "new",
    lead_status: "active",
    qualification_status: "unreviewed",
    priority: "normal",
    service_interest: "food_review",
    assigned_to: "00000000-0000-4000-8000-000000000099",
    next_follow_up_at: null,
    last_contacted_at: null,
    expected_close_date: null,
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function readModel(
  candidates: LeadFollowUpReadRow[],
  overrides: Partial<LeadFollowUpPriorityReadModel> = {},
): LeadFollowUpPriorityReadModel {
  return {
    candidates,
    eligibleAccessibleLeadCount: Math.max(candidates.length, 1),
    configuredAttentionLeadCount: candidates.length,
    authoritativeNow: now.toISOString(),
    authoritativeUtcDate: "2026-08-10",
    ...overrides,
  };
}

describe("Lead Follow-up Queue deterministic projection", () => {
  it.each([
    ["paused", row({ lead_status: "paused", assigned_to: null })],
    ["closed", row({ lead_status: "closed", assigned_to: null })],
    ["unqualified", row({ qualification_status: "unqualified", assigned_to: null })],
    ["quotation sent", row({ stage: "quotation_sent", assigned_to: null })],
    ["negotiation", row({ stage: "negotiation", assigned_to: null })],
    ["converted", row({ stage: "converted", assigned_to: null })],
    ["lost", row({ stage: "lost", assigned_to: null })],
    ["disqualified", row({ stage: "disqualified", assigned_to: null })],
  ])("excludes %s from base eligibility", (_label, candidate) => {
    expect(isLeadFollowUpBaseEligible(candidate)).toBe(false);
    expect(leadFollowUpAttentionCodesFor(candidate, now)).toEqual([]);
  });

  it("implements all seven closed predicates with exact boolean grouping", () => {
    expect(
      leadFollowUpAttentionCodesFor(
        row({
          stage: "qualified",
          next_follow_up_at: "2026-08-09T23:59:59.000Z",
          expected_close_date: "2026-08-09",
          assigned_to: null,
        }),
        now,
      ),
    ).toEqual([
      "overdue_follow_up",
      "expected_close_passed",
      "qualified_needs_progress",
      "unassigned_active",
    ]);
    expect(
      leadFollowUpAttentionCodesFor(
        row({ stage: "replied", next_follow_up_at: null }),
        now,
      ),
    ).toContain("replied_needs_review");
    expect(
      leadFollowUpAttentionCodesFor(
        row({
          stage: "ready_to_contact",
          last_contacted_at: null,
          next_follow_up_at: now.toISOString(),
        }),
        now,
      ),
    ).toContain("ready_to_contact_without_contact_record");
    expect(
      leadFollowUpAttentionCodesFor(
        row({
          stage: "ready_to_contact",
          last_contacted_at: "2026-08-01T00:00:00.000Z",
          next_follow_up_at: null,
        }),
        now,
      ),
    ).not.toContain("ready_to_contact_without_contact_record");
    expect(
      leadFollowUpAttentionCodesFor(
        row({ stage: "contacted", next_follow_up_at: null }),
        now,
      ),
    ).toContain("missing_follow_up");
    expect(
      leadFollowUpAttentionCodesFor(
        row({ stage: "quotation_requested", next_follow_up_at: null }),
        now,
      ),
    ).toContain("missing_follow_up");
    expect(
      leadFollowUpAttentionCodesFor(row({ assigned_to: null }), now),
    ).toEqual(["unassigned_active"]);
  });

  it.each([
    ["one second before", "2026-08-09T23:59:59.000Z", true],
    ["exactly now Z", "2026-08-10T00:00:00.000Z", false],
    ["one second after", "2026-08-10T00:00:01.000Z", false],
    ["positive offset", "2026-08-10T08:00:00+08:00", false],
    ["negative offset", "2026-08-09T17:00:00-07:00", false],
    ["fraction before", "2026-08-09T23:59:59.999Z", true],
  ])("compares RFC3339 timestamp case %s by instant", (_label, value, overdue) => {
    expect(
      leadFollowUpAttentionCodesFor(
        row({ stage: "researching", next_follow_up_at: value }),
        now,
      ).includes("overdue_follow_up"),
    ).toBe(overdue);
  });

  it.each([
    ["yesterday", "2026-08-09", true],
    ["today", "2026-08-10", false],
    ["tomorrow", "2026-08-11", false],
  ])("uses the UTC request date for expected close %s", (_label, date, passed) => {
    expect(
      leadFollowUpAttentionCodesFor(
        row({ stage: "meeting_scheduled", expected_close_date: date }),
        now,
      ).includes("expected_close_passed"),
    ).toBe(passed);
  });

  it("does not configure attention for a new assigned Lead", () => {
    expect(leadFollowUpAttentionCodesFor(row(), now)).toEqual([]);
  });

  it("uses category priority for overlap and limits display to three groups/five Leads", () => {
    const candidates = [
      row({
        id: "00000000-0000-4000-8000-000000000010",
        stage: "qualified",
        next_follow_up_at: "2026-08-09T00:00:00.000Z",
        expected_close_date: "2026-08-09",
        assigned_to: null,
      }),
      row({
        id: "00000000-0000-4000-8000-000000000011",
        stage: "meeting_scheduled",
        expected_close_date: "2026-08-09",
      }),
      row({
        id: "00000000-0000-4000-8000-000000000012",
        stage: "replied",
      }),
      row({
        id: "00000000-0000-4000-8000-000000000013",
        stage: "ready_to_contact",
      }),
      row({
        id: "00000000-0000-4000-8000-000000000014",
        stage: "contacted",
      }),
    ];
    const queue = projectLeadFollowUpQueue(readModel(candidates));
    expect(queue.groups.map((group) => group.code)).toEqual([
      "overdue_follow_up",
      "expected_close_passed",
      "replied_needs_review",
    ]);
    expect(queue.groups.flatMap((group) => group.leads)).toHaveLength(3);
    expect(queue.groups[0]?.leads[0]?.leadId).toBe(candidates[0]?.id);
    expect(queue.groups.every((group) => group.leads.length <= 5)).toBe(true);
  });

  it.each([
    [0, 0, 0, "no_eligible_leads"],
    [80, 80, 50, "limited_lead_data"],
    [1, 0, 0, "no_configured_attention"],
    [4, 4, 4, "lead_attention_available"],
  ])(
    "applies overview precedence for %i/%i/%i",
    (eligible, attention, analyzed, expected) => {
      expect(deriveLeadFollowUpOverview(eligible, attention, analyzed)).toBe(
        expected,
      );
    },
  );

  it("reports exact 50-of-80 coverage without claiming completeness", () => {
    const candidates = Array.from({ length: 50 }, (_, index) =>
      row({
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        assigned_to: null,
      }),
    );
    const queue = projectLeadFollowUpQueue(
      readModel(candidates, {
        eligibleAccessibleLeadCount: 80,
        configuredAttentionLeadCount: 80,
      }),
    );
    expect(queue).toMatchObject({
      overview: "limited_lead_data",
      analyzedCandidateCount: 50,
      configuredAttentionLeadCount: 80,
      candidateLimit: 50,
    });
  });

  it("rejects duplicate, unsupported and over-limit candidate sets", () => {
    const unassigned = row({ assigned_to: null });
    expect(() =>
      projectLeadFollowUpQueue(
        readModel([unassigned, unassigned], {
          eligibleAccessibleLeadCount: 2,
          configuredAttentionLeadCount: 2,
        }),
      ),
    ).toThrow("Duplicate");
    expect(() =>
      projectLeadFollowUpQueue(
        readModel([row()], {
          eligibleAccessibleLeadCount: 1,
          configuredAttentionLeadCount: 1,
        }),
      ),
    ).toThrow("no configured attention");
    expect(() =>
      projectLeadFollowUpQueue(
        readModel(
          Array.from({ length: 51 }, (_, index) =>
            row({
              id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
              assigned_to: null,
            }),
          ),
          {
            eligibleAccessibleLeadCount: 51,
            configuredAttentionLeadCount: 51,
          },
        ),
      ),
    ).toThrow("counts");
    expect(() =>
      projectLeadFollowUpQueue(
        readModel([], {
          eligibleAccessibleLeadCount: 0,
          configuredAttentionLeadCount: 0,
          authoritativeUtcDate: "2026-08-09",
        }),
      ),
    ).toThrow("disagrees");
  });

  it("preserves authorized Unicode/title text and uses factual renderer copy", () => {
    const queue = projectLeadFollowUpQueue(
      readModel([
        row({
          title: '<script>alert("x")</script> 食品',
          stage: "ready_to_contact",
        }),
      ]),
    );
    expect(queue.groups[0]).toMatchObject({
      code: "ready_to_contact_without_contact_record",
      reason: "No last-contacted timestamp is recorded.",
    });
    expect(queue.groups[0]?.leads[0]?.title).toBe(
      '<script>alert("x")</script> 食品',
    );
    expect(JSON.stringify(queue)).not.toMatch(/nobody contacted|hot|likely to buy/iu);
  });
});
