// @vitest-environment jsdom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { archiveLeadAction, createLeadAction, restoreLeadAction, updateLeadAction } from "@/app/(dashboard)/leads/actions";
import LeadNotFound from "@/app/(dashboard)/leads/[leadId]/not-found";
import { parseCreateLeadForm } from "@/lib/leads/lead-form";
import type { Lead, LeadActor } from "@/lib/leads/lead.types";
import { LeadArchiveDialog } from "./lead-archive-dialog";
import { LeadDetails } from "./lead-details";
import { LeadEmptyState } from "./lead-empty-state";
import { LeadForm } from "./lead-form";
import { LeadList } from "./lead-list";

const leadId = "11111111-1111-4111-8111-111111111111";
const companyId = "22222222-2222-4222-8222-222222222222";
const contactId = "33333333-3333-4333-8333-333333333333";
const actorId = "44444444-4444-4444-8444-444444444444";
const otherId = "55555555-5555-4555-8555-555555555555";

const lead: Lead = {
  id: leadId,
  companyId,
  primaryContactId: contactId,
  title: "Domino's festive campaign",
  stage: "qualified",
  leadStatus: "active",
  qualificationStatus: "qualified",
  priority: "high",
  leadScore: 78,
  estimatedValue: 5000,
  currency: "MYR",
  serviceInterest: "hard_selling_video",
  assignedTo: actorId,
  createdBy: actorId,
  sourceType: "campaign",
  sourceUrl: "https://example.com/campaign",
  sourceSignalId: null,
  sourceCampaign: "Festive 2026",
  referralName: null,
  discoveredAt: "2026-07-20T08:00:00.000Z",
  lastVerifiedAt: null,
  businessNeed: "Launch video",
  budgetNotes: null,
  timelineNotes: null,
  decisionMakerNotes: null,
  expectedCloseDate: "2026-08-15",
  nextStep: "Book discovery call",
  nextFollowUpAt: "2026-07-26T02:00:00.000Z",
  lastContactedAt: "2026-07-22T02:00:00.000Z",
  notes: null,
  convertedAt: null,
  lostAt: null,
  lostReason: null,
  disqualifiedAt: null,
  disqualifiedReason: null,
  createdAt: "2026-07-20T08:00:00.000Z",
  updatedAt: "2026-07-23T08:00:00.000Z",
  deletedAt: null,
  fingerprint: "a".repeat(32),
};

const manager: LeadActor = { userId: actorId, role: "sales_manager", isActive: true };
const representative: LeadActor = { userId: otherId, role: "sales_representative", isActive: true };
const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/(dashboard)/leads/actions", () => ({
  createLeadAction: vi.fn(),
  updateLeadAction: vi.fn(),
  archiveLeadAction: vi.fn(),
  restoreLeadAction: vi.fn(),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createLeadAction).mockResolvedValue({ status: "idle" });
  vi.mocked(updateLeadAction).mockResolvedValue({ status: "idle" });
  vi.mocked(archiveLeadAction).mockResolvedValue({ status: "idle" });
  vi.mocked(restoreLeadAction).mockResolvedValue({ status: "idle" });
});

afterEach(cleanup);

describe("Leads UI", () => {
  it("renders the production list fields with page size 25", () => {
    render(<LeadList actor={manager} leads={[lead]} pagination={{ page: 1, pageSize: 25, total: 1, totalPages: 1 }} />);
    expect(screen.getByRole("region", { name: "Leads list" }).getAttribute("data-page-size")).toBe("25");
    expect(screen.getAllByText(lead.title).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Qualified").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Hard Selling Video").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: `View ${lead.title} details` })[0]?.getAttribute("href")).toBe(`/leads/${leadId}`);
  });

  it("renders an actionable empty state", () => {
    render(<LeadEmptyState />);
    expect(screen.getByText("No leads yet")).toBeDefined();
    expect(screen.getByRole("link", { name: "Add first lead" }).getAttribute("href")).toBe("/leads/new");
  });

  it("renders create fields and sends browser numeric values through the form contract", () => {
    render(<LeadForm actor={manager} defaultDiscoveredAt="2026-07-24T00:00:00.000Z" mode="create" />);
    expect(screen.getByRole("textbox", { name: /Lead title/ })).toHaveProperty("required", true);
    expect(screen.getByRole("combobox", { name: "Stage" })).toBeDefined();
    expect(screen.getByRole("combobox", { name: "Service interest" })).toBeDefined();

    const data = new FormData();
    data.set("title", "Campaign lead");
    data.set("sourceType", "manual");
    data.set("discoveredAt", "2026-07-24T00:00:00.000Z");
    data.set("leadScore", "75");
    data.set("estimatedValue", "3500.50");
    data.set("companyId", "");
    data.set("serviceInterest", "");
    const parsed = parseCreateLeadForm(data);
    expect(parsed.input).toMatchObject({ leadScore: 75, estimatedValue: 3500.5, companyId: null, serviceInterest: null });
  });

  it("presents field validation and focuses the invalid input", async () => {
    vi.mocked(createLeadAction).mockResolvedValueOnce({ status: "validation_error", message: "Check fields.", fieldErrors: { title: ["Title is required"] } });
    render(<LeadForm actor={manager} defaultDiscoveredAt="2026-07-24T00:00:00.000Z" mode="create" />);
    await userEvent.click(screen.getByRole("button", { name: "Create lead" }));
    expect(await screen.findByText("Title is required")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /Lead title/ }));
  });

  it("requires explicit duplicate confirmation before create", async () => {
    vi.mocked(createLeadAction)
      .mockResolvedValueOnce({ status: "duplicate_warning", duplicateCandidateIds: [leadId], confirmationToken: "signed-lead-token" })
      .mockResolvedValueOnce({ status: "success", leadId, redirectTo: `/leads/${leadId}` });
    render(<LeadForm actor={manager} defaultDiscoveredAt="2026-07-24T00:00:00.000Z" mode="create" />);
    await userEvent.click(screen.getByRole("button", { name: "Create lead" }));
    expect(await screen.findByText("Possible duplicate lead")).toBeDefined();
    expect(screen.getByText(leadId)).toBeDefined();
    await userEvent.click(screen.getByRole("button", { name: "Create anyway" }));
    expect(vi.mocked(createLeadAction).mock.calls[1]?.[1].get("confirmationToken")).toBe("signed-lead-token");
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/leads/${leadId}`));
  });

  it("hydrates edit values and completes the update workflow", async () => {
    vi.mocked(updateLeadAction).mockResolvedValueOnce({ status: "success", leadId });
    render(<LeadForm actor={manager} lead={lead} mode="edit" />);
    expect((screen.getByRole("textbox", { name: /Lead title/ }) as HTMLInputElement).value).toBe(lead.title);
    expect((screen.getByRole("combobox", { name: "Stage" }) as HTMLSelectElement).value).toBe("qualified");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/leads/${leadId}`));
  });

  it("shows archive only to management and archives after confirmation", async () => {
    const { rerender } = render(<LeadList actor={representative} leads={[lead]} pagination={{ page: 1, pageSize: 25, total: 1, totalPages: 1 }} />);
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();

    rerender(<LeadArchiveDialog leadId={leadId} title={lead.title} />);
    vi.mocked(archiveLeadAction).mockResolvedValueOnce({ status: "success", leadId, redirectTo: "/leads" });
    await userEvent.click(screen.getByRole("button", { name: "Archive" }));
    await userEvent.click(screen.getByRole("button", { name: "Archive lead" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/leads"));
  });

  it("restores archived Leads through the management view", async () => {
    vi.mocked(restoreLeadAction).mockResolvedValueOnce({ status: "success", leadId, redirectTo: "/leads" });
    render(<LeadList actor={manager} archived leads={[{ ...lead, deletedAt: "2026-07-24T00:00:00.000Z" }]} pagination={{ page: 1, pageSize: 25, total: 1, totalPages: 1 }} />);
    expect(screen.queryByRole("link", { name: `View ${lead.title} details` })).toBeNull();
    await userEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]!);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/leads"));
  });

  it("renders grouped details and safe not-found UI", () => {
    const { rerender } = render(<LeadDetails canArchive canEdit lead={lead} />);
    expect(screen.getByRole("heading", { name: lead.title })).toBeDefined();
    expect(screen.getByText("Lead overview")).toBeDefined();
    expect(screen.getByText("Source and provenance")).toBeDefined();
    expect(screen.getByRole("link", { name: "Edit lead" }).getAttribute("href")).toBe(`/leads/${leadId}/edit`);
    rerender(<LeadNotFound />);
    expect(screen.getByText("Lead not found")).toBeDefined();
    expect(screen.getByRole("link", { name: "Back to Leads" })).toBeDefined();
  });
});
