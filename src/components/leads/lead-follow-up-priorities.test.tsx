// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const action = vi.hoisted(() => vi.fn());
vi.mock("@/app/(dashboard)/leads/follow-up-action", () => ({
  generateLeadFollowUpQueueAction: action,
}));

import { LeadFollowUpPriorities } from "./lead-follow-up-priorities";

const leadId = "11111111-1111-4111-8111-111111111111";
const title = '<script>alert("x")</script> 食品';

function successState(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    message:
      "Follow-up priorities reviewed from accessible CRM metadata. No CRM data was changed.",
    queue: {
      overview: "lead_attention_available",
      overviewText:
        "Configured attention signals are available for deterministic review.",
      eligibleAccessibleLeadCount: 1,
      configuredAttentionLeadCount: 1,
      analyzedCandidateCount: 1,
      candidateLimit: 50,
      groups: [
        {
          code: "ready_to_contact_without_contact_record",
          heading: "Ready to contact",
          reason: "No last-contacted timestamp is recorded.",
          action: "Review the Lead and its recorded contact metadata.",
          leads: [
            {
              leadId,
              title,
              stage: "ready_to_contact",
              priority: "urgent",
              serviceInterest: "food_review",
              nextFollowUpAt: null,
              expectedCloseDate: null,
            },
          ],
        },
      ],
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  action.mockResolvedValue(successState());
});

afterEach(cleanup);

describe("Lead Follow-up Queue UI", () => {
  it("is opt-in, submits no browser queue data, escapes titles and has no result mutation controls", async () => {
    render(<LeadFollowUpPriorities />);
    expect(
      screen.queryByRole("region", { name: "Lead follow-up queue result" }),
    ).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Review follow-up priorities" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1] as FormData;
    expect(Array.from(formData.entries())).toEqual([]);

    const result = await screen.findByRole("region", {
      name: "Lead follow-up queue result",
    });
    expect(within(result).getByText(title, { exact: true })).toBeDefined();
    expect(
      within(result).getByRole("link", { name: title }).getAttribute("href"),
    ).toBe(`/leads/${leadId}`);
    expect(within(result).getByText("Priority Urgent", { exact: false })).toBeDefined();
    expect(within(result).queryByRole("button")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(result.textContent).not.toMatch(
      /change stage|assign owner|set follow-up|convert|archive|create activity/iu,
    );
  });

  it("renders exact truncated coverage and bounded disclosure", async () => {
    action.mockResolvedValueOnce(
      successState({
        overview: "limited_lead_data",
        overviewText:
          "Configured attention signals exist beyond the bounded candidate review shown below.",
        eligibleAccessibleLeadCount: 90,
        configuredAttentionLeadCount: 80,
        analyzedCandidateCount: 50,
        groups: [],
      }),
    );
    render(<LeadFollowUpPriorities />);
    await userEvent.click(
      screen.getByRole("button", { name: "Review follow-up priorities" }),
    );
    const result = await screen.findByRole("region", {
      name: "Lead follow-up queue result",
    });
    expect(
      within(result).getByText(
        /Analyzed 50 of 80 accessible Leads with configured attention signals/,
      ),
    ).toBeDefined();
    expect(
      within(result).getByText(/bounded category-aware review and may omit Leads/),
    ).toBeDefined();
    expect(result.textContent).not.toMatch(
      /all clear|nothing else needs attention|complete pipeline|no other follow-up needed/iu,
    );
  });

  it("shows safe failures without raw repository details", async () => {
    action.mockResolvedValueOnce({
      status: "unavailable",
      message: "The Lead Follow-up Queue is temporarily unavailable.",
    });
    render(<LeadFollowUpPriorities />);
    await userEvent.click(
      screen.getByRole("button", { name: "Review follow-up priorities" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "The Lead Follow-up Queue is temporarily unavailable.",
    );
  });
});
