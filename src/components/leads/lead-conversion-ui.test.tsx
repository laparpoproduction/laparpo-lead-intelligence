// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { convertLeadToOpportunityAction } from "@/app/(dashboard)/leads/conversion/actions";
import type { Lead } from "@/lib/leads/lead.types";
import type { LeadConversionRecord } from "@/lib/opportunities/opportunity.types";
import { LeadConversionDialog } from "./lead-conversion-dialog";
import { LeadDetails } from "./lead-details";

const router = { refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/(dashboard)/leads/conversion/actions", () => ({
  convertLeadToOpportunityAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/leads/actions", () => ({
  archiveLeadAction: vi.fn(),
}));

const leadId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const lead: Lead = {
  id: leadId,
  companyId: null,
  primaryContactId: null,
  title: "A very long campaign Lead title that remains readable on mobile",
  stage: "qualified",
  leadStatus: "active",
  qualificationStatus: "qualified",
  priority: "high",
  leadScore: 80,
  estimatedValue: 5000,
  currency: "MYR",
  serviceInterest: "hard_selling_video",
  assignedTo: actorId,
  createdBy: actorId,
  sourceType: "manual",
  sourceUrl: null,
  sourceSignalId: null,
  sourceCampaign: null,
  referralName: null,
  discoveredAt: "2026-07-20T08:00:00.000Z",
  lastVerifiedAt: null,
  businessNeed: null,
  budgetNotes: null,
  timelineNotes: null,
  decisionMakerNotes: null,
  expectedCloseDate: null,
  nextStep: null,
  nextFollowUpAt: null,
  lastContactedAt: null,
  notes: "Historical note",
  convertedAt: null,
  lostAt: null,
  lostReason: null,
  disqualifiedAt: null,
  disqualifiedReason: null,
  createdAt: "2026-07-20T08:00:00.000Z",
  updatedAt: "2026-07-20T08:00:00.000Z",
  deletedAt: null,
  fingerprint: null,
};
const conversion: LeadConversionRecord = {
  leadId,
  opportunityId,
  convertedAt: "2026-07-27T08:00:00.000Z",
  createdBy: actorId,
  createdAt: "2026-07-27T08:00:00.000Z",
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(convertLeadToOpportunityAction).mockResolvedValue({
    status: "idle",
  });
});
afterEach(cleanup);

async function openDialog(props: Partial<React.ComponentProps<typeof LeadConversionDialog>> = {}) {
  render(
    <LeadConversionDialog
      currency="MYR"
      estimatedValue={5000}
      leadId={leadId}
      serviceInterest="hard_selling_video"
      title={lead.title}
      {...props}
    />,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Convert to Opportunity" }),
  );
}

describe("Lead conversion workflow UI", () => {
  it("shows the conversion control only when the detail workflow permits it", () => {
    const { rerender } = render(
      <LeadDetails canArchive={false} canConvert canEdit lead={lead} />,
    );
    expect(
      screen.getByRole("button", { name: "Convert to Opportunity" }),
    ).toBeDefined();
    rerender(
      <LeadDetails canArchive={false} canConvert={false} canEdit={false} lead={lead} />,
    );
    expect(
      screen.queryByRole("button", { name: "Convert to Opportunity" }),
    ).toBeNull();
  });

  it("uses the safe service mapping and valid MYR prefill", async () => {
    await openDialog();
    expect(
      (screen.getByRole("combobox", {
        name: "Opportunity service",
      }) as HTMLSelectElement).value,
    ).toBe("hard_selling");
    expect(
      (screen.getByRole("spinbutton", {
        name: "Estimated value (MYR)",
      }) as HTMLInputElement).value,
    ).toBe("5000");
  });

  it("requires explicit service selection for unknown data", async () => {
    await openDialog({ serviceInterest: "future_service" });
    expect(
      (screen.getByRole("combobox", {
        name: "Opportunity service",
      }) as HTMLSelectElement).value,
    ).toBe("");
  });

  it("does not copy non-MYR value or perform FX conversion", async () => {
    await openDialog({ currency: "USD", estimatedValue: 5000 });
    expect(
      (screen.getByRole("spinbutton", {
        name: "Estimated value (MYR)",
      }) as HTMLInputElement).value,
    ).toBe("");
    expect(screen.getByText(/No automatic FX conversion is performed/)).toBeDefined();
  });

  it("associates validation errors and focuses the first invalid field", async () => {
    vi.mocked(convertLeadToOpportunityAction).mockResolvedValueOnce({
      status: "validation_error",
      message: "Check the highlighted conversion fields.",
      fieldErrors: {
        service: ["Select a supported Opportunity service."],
        estimatedValueMyr: ["Enter a valid MYR amount."],
      },
    });
    await openDialog({ serviceInterest: "future_service", estimatedValue: null });
    const service = screen.getByRole("combobox", {
      name: "Opportunity service",
    });
    expect(service.getAttribute("aria-describedby")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm conversion" }),
    );
    await screen.findByText("Select a supported Opportunity service.");
    expect(service.getAttribute("aria-invalid")).toBe("true");
    expect(service.getAttribute("aria-describedby")).toMatch(/service-error/);
    expect(document.activeElement).toBe(service);
    const value = screen.getByRole("spinbutton", {
      name: "Estimated value (MYR)",
    });
    expect(value.getAttribute("aria-describedby")).toMatch(
      /estimated-value-error.*estimated-value-help/,
    );
  });

  it("disables repeat submission and shows processing text while pending", async () => {
    let resolve!: (value: { status: "success"; leadId: string; opportunityId: string }) => void;
    vi.mocked(convertLeadToOpportunityAction).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await openDialog();
    const submit = screen.getByRole("button", { name: "Confirm conversion" });
    await userEvent.click(submit);
    expect(
      screen.getByRole("button", { name: /Converting/ }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByRole("status").textContent).toContain(
      "Lead conversion is processing",
    );
    resolve({ status: "success", leadId, opportunityId });
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("shows success and already-converted outcomes safely", async () => {
    vi.mocked(convertLeadToOpportunityAction).mockResolvedValueOnce({
      status: "already_converted",
      message: "This Lead was already converted safely.",
      leadId,
      opportunityId,
    });
    await openDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm conversion" }),
    );
    expect(await screen.findByText("Conversion complete")).toBeDefined();
    expect(screen.getByText(new RegExp(opportunityId))).toBeDefined();
  });

  it("renders ledger-backed converted Leads as historical and read-only", () => {
    render(
      <LeadDetails
        activityTimeline={<div>Activity timeline remains visible</div>}
        canArchive
        canConvert={false}
        canEdit={false}
        conversion={conversion}
        lead={{
          ...lead,
          stage: "converted",
          leadStatus: "closed",
          convertedAt: conversion.convertedAt,
        }}
      />,
    );
    expect(screen.queryByRole("link", { name: "Edit lead" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Convert to Opportunity" }),
    ).toBeNull();
    expect(screen.getByText(/Converted and closed/)).toBeDefined();
    expect(screen.getByText(opportunityId)).toBeDefined();
    expect(screen.getByText("Activity timeline remains visible")).toBeDefined();
  });

  it("renders unresolved legacy conversion without inventing an Opportunity", () => {
    render(
      <LeadDetails
        canArchive
        canConvert={false}
        canEdit={false}
        lead={{ ...lead, stage: "converted", leadStatus: "closed" }}
        legacyConverted
      />,
    );
    expect(screen.getByText(/Historical legacy conversion/)).toBeDefined();
    expect(screen.queryByText(/Opportunity ID:/)).toBeNull();
  });
});
