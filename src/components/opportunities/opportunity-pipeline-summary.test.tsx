// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const action = vi.hoisted(() => vi.fn());
vi.mock("@/app/(dashboard)/opportunities/pipeline/summary-action", () => ({
  generateOpportunityPipelineSummaryAction: action,
}));

import { OpportunityPipelineSummary } from "./opportunity-pipeline-summary";

const opportunityId = "22222222-2222-4222-8222-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  action.mockResolvedValue({
    status: "success",
    message:
      "AI-assisted priority generated. No CRM data, stages, owners, probabilities or values were changed.",
    summary: {
      overview:
        "Your accessible pipeline contains 1 active Opportunities. AI-assisted prioritization suggests reviewing the items below.",
      activeOpportunityCount: 1,
      analyzedCandidateCount: 1,
      candidateLimit: 75,
      focusAreas: [
        {
          code: "overdue_expected_close",
          heading: "Expected-close dates that have passed",
          reason:
            "These Opportunities have an expected-close date earlier than today.",
          action:
            "Review the Opportunities and decide whether the expected-close plan needs updating.",
          opportunities: [
            {
              opportunityId,
              label: "Authorized Lead — Authorized Company",
              service: "corporate",
              pipelineStage: "new",
              estimatedValueMyr: 8_000,
              expectedCloseDate: "2026-08-01",
            },
          ],
        },
      ],
    },
  });
});

afterEach(cleanup);

describe("Opportunity pipeline summary UI", () => {
  it("does not present a working AI control when disabled", () => {
    render(<OpportunityPipelineSummary enabled={false} />);
    expect(
      (screen.getByRole("button", {
        name: "AI summary unavailable",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("is opt-in, submits no browser pipeline payload, and renders application-owned accessible output", async () => {
    render(<OpportunityPipelineSummary />);
    expect(
      screen.queryByRole("region", { name: "AI pipeline summary result" }),
    ).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Summarize pipeline" }),
    );
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1] as FormData;
    expect(Array.from(formData.entries())).toEqual([]);

    const result = screen.getByRole("region", {
      name: "AI pipeline summary result",
    });
    expect(
      within(result).getByRole("heading", {
        name: "Expected-close dates that have passed",
      }),
    ).toBeDefined();
    expect(
      within(result)
        .getByRole("link", { name: "Authorized Lead — Authorized Company" })
        .getAttribute("href"),
    ).toBe(`/opportunities/${opportunityId}`);
    expect(within(result).getByText(/maximum 75 detailed candidates/)).toBeDefined();
    expect(within(result).queryByRole("button")).toBeNull();
    expect(JSON.stringify(action.mock.calls)).not.toContain("companyName");
  });

  it("shows a safe error without raw provider details", async () => {
    action.mockResolvedValueOnce({
      status: "provider_unavailable",
      message: "Opportunity pipeline summarization is temporarily unavailable.",
    });
    render(<OpportunityPipelineSummary />);
    await userEvent.click(
      screen.getByRole("button", { name: "Summarize pipeline" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Opportunity pipeline summarization is temporarily unavailable.",
    );
  });

  it("discloses exact bounded category-aware coverage for a truncated pipeline", async () => {
    action.mockResolvedValueOnce({
      status: "success",
      message:
        "AI-assisted priority generated. No CRM data, stages, owners, probabilities or values were changed.",
      summary: {
        overview:
          "This AI-assisted summary covers a bounded portion of your accessible active Opportunities.",
        activeOpportunityCount: 120,
        analyzedCandidateCount: 75,
        candidateLimit: 75,
        focusAreas: [],
      },
    });
    render(<OpportunityPipelineSummary />);
    await userEvent.click(
      screen.getByRole("button", { name: "Summarize pipeline" }),
    );
    const result = await screen.findByRole("region", {
      name: "AI pipeline summary result",
    });
    expect(within(result).getByText(/Analyzed 75 of 120/)).toBeDefined();
    expect(
      within(result).getByText(/bounded category-aware analysis/),
    ).toBeDefined();
    expect(
      within(result).getByText(/prioritized before older remaining items/),
    ).toBeDefined();
  });
});
