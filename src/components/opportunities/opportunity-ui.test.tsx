// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  OpportunityEmptyState,
  OpportunityFilteredEmptyState,
} from "./opportunity-empty-state";
import { OpportunityList } from "./opportunity-list";
import { OpportunityListToolbar } from "./opportunity-list-toolbar";
import OpportunitiesError from "@/app/(dashboard)/opportunities/error";
import OpportunitiesLoading from "@/app/(dashboard)/opportunities/loading";
import { parseOpportunityQueryState } from "@/lib/opportunities/opportunity-query";
import type { OpportunityListItem } from "@/lib/opportunities/opportunity.types";
import { formatOpportunityMyr } from "@/lib/opportunities/opportunity-ui";

const router = { push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const conversion: OpportunityListItem = {
  id: "11111111-1111-4111-8111-111111111111",
  leadId: "22222222-2222-4222-8222-222222222222",
  leadTitle:
    "A very long festive campaign title that must wrap safely on small screens",
  companyId: "33333333-3333-4333-8333-333333333333",
  companyName:
    "A very long client company name that must not overflow the card boundary",
  service: "hard_selling",
  estimatedValueMyr: 5000,
  quotationNumber: "QUOTATION-2026-WITH-A-LONG-REFERENCE",
  quotationSentAt: "2026-07-26T08:00:00.000Z",
  meetingAt: null,
  depositAmountMyr: null,
  depositReceivedAt: null,
  createdAt: "2026-07-25T08:00:00.000Z",
  updatedAt: "2026-07-26T08:00:00.000Z",
  isConversion: true,
  convertedAt: "2026-07-25T08:00:00.000Z",
};

const ordinary: OpportunityListItem = {
  ...conversion,
  id: "44444444-4444-4444-8444-444444444444",
  isConversion: false,
  convertedAt: null,
  estimatedValueMyr: null,
  quotationNumber: null,
};

describe("Opportunities UI", () => {
  it("renders multiple Opportunities for one Lead with ledger-based labels", () => {
    render(
      <OpportunityList
        opportunities={[conversion, ordinary]}
        pagination={{
          page: 1,
          pageSize: 25,
          total: 2,
          totalPages: 1,
        }}
        query={parseOpportunityQueryState({})}
      />,
    );
    expect(
      screen.getByRole("region", { name: "Opportunities list" })
        .getAttribute("data-page-size"),
    ).toBe("25");
    expect(screen.getAllByText("Conversion Opportunity").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ordinary Opportunity").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hard-selling marketing video").length).toBe(4);
    expect(screen.getAllByText("Not scheduled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not recorded").length).toBeGreaterThan(0);
  });

  it("formats MYR and never converts null to zero", () => {
    expect(formatOpportunityMyr(3500)).toMatch(/RM/);
    expect(formatOpportunityMyr(3500)).toMatch(/3,500/);
    expect(formatOpportunityMyr(null)).toBe("Not recorded");
  });

  it("uses wrap-safe classes for long user content", () => {
    render(
      <OpportunityList
        opportunities={[conversion]}
        pagination={{
          page: 1,
          pageSize: 25,
          total: 1,
          totalPages: 1,
        }}
        query={parseOpportunityQueryState({})}
      />,
    );
    expect(screen.getAllByText(conversion.leadTitle)[0]?.className).toContain(
      "break-words",
    );
    expect(screen.getAllByText(conversion.id)[0]?.className).toContain(
      "break-all",
    );
  });

  it("resets page when search, filters or sorting changes", async () => {
    render(
      <OpportunityListToolbar
        query={parseOpportunityQueryState({
          q: "old",
          service: "food_review",
          kind: "conversion",
          sort: "oldest",
          page: "7",
        })}
      />,
    );
    const search = screen.getByRole("searchbox", {
      name: "Search opportunities",
    });
    await userEvent.clear(search);
    await userEvent.type(search, "new client");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Service" }),
      "corporate",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Opportunity kind" }),
      "ordinary",
    );
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Sort" }),
      "value_desc",
    );
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        "/opportunities?q=new+client&service=corporate&kind=ordinary&sort=value_desc",
      ),
    );
  });

  it("preserves filters in accessible pagination links", () => {
    render(
      <OpportunityList
        opportunities={[ordinary]}
        pagination={{
          page: 2,
          pageSize: 25,
          total: 70,
          totalPages: 3,
        }}
        query={parseOpportunityQueryState({
          q: "agency",
          service: "event_coverage",
          kind: "ordinary",
          sort: "oldest",
          page: "2",
        })}
      />,
    );
    expect(
      screen
        .getByRole("link", { name: "Next opportunities page" })
        .getAttribute("href"),
    ).toBe(
      "/opportunities?q=agency&service=event_coverage&kind=ordinary&sort=oldest&page=3",
    );
  });

  it("distinguishes empty and filtered-empty states", () => {
    const { rerender } = render(<OpportunityEmptyState />);
    expect(screen.getByText("No opportunities yet")).toBeDefined();
    rerender(
      <OpportunityFilteredEmptyState
        query={parseOpportunityQueryState({ q: "missing" })}
      />,
    );
    expect(screen.getByText("No matching opportunities")).toBeDefined();
    expect(
      screen.getByRole("link", { name: "Clear all filters" }).getAttribute("href"),
    ).toBe("/opportunities");
  });

  it("provides safe loading and error states", () => {
    const { rerender } = render(<OpportunitiesLoading />);
    expect(screen.getByRole("status", { name: "Loading opportunities" })).toBeDefined();
    rerender(
      <OpportunitiesError
        error={Object.assign(new Error("raw database secret"), {
          digest: "safe-digest",
        })}
        reset={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByText(/raw database secret/)).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });
});
