import { describe, expect, it, vi } from "vitest";
import { LeadRepositoryNotFoundError } from "./lead.repository";
import { LeadDuplicateError, LeadNotFoundError, LeadPermissionError, LeadService } from "./lead.service";
import type { LeadActor, LeadConfirmationContext } from "./lead.types";

const representative: LeadActor = {
  userId: "44444444-4444-4444-8444-444444444444",
  role: "sales_representative",
  isActive: true,
};

const manager: LeadActor = {
  userId: "33333333-3333-4333-8333-333333333333",
  role: "sales_manager",
  isActive: true,
};

const leadFixture = {
  id: "11111111-1111-4111-8111-111111111111",
  companyId: null,
  primaryContactId: null,
  title: "KFC Ramadan",
  stage: "new",
  leadStatus: "active",
  qualificationStatus: "unreviewed",
  priority: "high",
  leadScore: 42,
  estimatedValue: 2500,
  currency: "MYR",
  serviceInterest: "food_review",
  assignedTo: null,
  createdBy: representative.userId,
  sourceType: "company_website",
  sourceUrl: "https://example.my/lead",
  sourceSignalId: null,
  sourceCampaign: "q1-campaign",
  referralName: null,
  discoveredAt: "2026-06-01T00:00:00.000Z",
  lastVerifiedAt: null,
  businessNeed: "Need content",
  budgetNotes: null,
  timelineNotes: null,
  decisionMakerNotes: null,
  expectedCloseDate: "2026-06-15",
  nextStep: "Send quote",
  nextFollowUpAt: "2026-06-05T00:00:00.000Z",
  lastContactedAt: null,
  notes: "A note",
  convertedAt: null,
  lostAt: null,
  lostReason: null,
  disqualifiedAt: null,
  disqualifiedReason: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-02T00:00:00.000Z",
  deletedAt: null,
  fingerprint: "0123456789abcdef0123456789abcdef",
};

function repositoryMock(overrides: Record<string, unknown> = {}) {
  return {
    create: vi.fn().mockResolvedValue(leadFixture),
    getById: vi.fn().mockResolvedValue(leadFixture),
    update: vi.fn().mockResolvedValue(leadFixture),
    softDelete: vi.fn().mockResolvedValue(undefined),
    restore: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ items: [leadFixture], page: 1, pageSize: 25, total: 1, totalPages: 1 }),
    search: vi.fn().mockResolvedValue({ items: [leadFixture], page: 1, pageSize: 25, total: 1, totalPages: 1 }),
    listArchived: vi.fn().mockResolvedValue({ items: [leadFixture], page: 1, pageSize: 25, total: 1, totalPages: 1 }),
    listOverdueFollowUps: vi.fn().mockResolvedValue({ items: [leadFixture], page: 1, pageSize: 25, total: 1, totalPages: 1 }),
    listUpcomingFollowUps: vi.fn().mockResolvedValue({ items: [leadFixture], page: 1, pageSize: 25, total: 1, totalPages: 1 }),
    findByAssignee: vi.fn().mockResolvedValue({ items: [leadFixture], page: 1, pageSize: 25, total: 1, totalPages: 1 }),
    findDuplicateCandidates: vi.fn().mockResolvedValue([]),
    canAccess: vi.fn().mockResolvedValue(true),
    canModify: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe("LeadService", () => {
  it("validates and creates a lead for an active user", async () => {
    const repository = repositoryMock();
    const service = new LeadService(repository as never);
    await expect(service.create({ title: "  KFC Ramadan  ", sourceUrl: "https://example.my/lead", sourceType: "company_website", discoveredAt: "2026-06-01T00:00:00.000Z" }, representative)).resolves.toEqual(leadFixture);
    expect(repository.findDuplicateCandidates).toHaveBeenCalled();
  });

  it("rejects a corroborated duplicate candidate", async () => {
    const repository = repositoryMock({
      findDuplicateCandidates: vi.fn().mockResolvedValue([leadFixture]),
    });
    const service = new LeadService(repository as never);
    await expect(service.create({ title: "KFC Ramadan", sourceUrl: "https://example.my/lead", sourceType: "company_website", discoveredAt: "2026-06-01T00:00:00.000Z" }, representative)).rejects.toBeInstanceOf(LeadDuplicateError);
  });

  it("rejects restore requests from representatives", async () => {
    const service = new LeadService(repositoryMock() as never);
    await expect(service.restore("11111111-1111-4111-8111-111111111111", representative)).rejects.toBeInstanceOf(LeadPermissionError);
  });

  it("maps restore not-found failures to not-found errors", async () => {
    const repository = repositoryMock({
      restore: vi.fn().mockRejectedValue(new LeadRepositoryNotFoundError("restore")),
    });
    const service = new LeadService(repository as never);
    await expect(service.restore("11111111-1111-4111-8111-111111111111", manager)).rejects.toBeInstanceOf(LeadNotFoundError);
  });

  it("enforces include-deleted access rules and forwards the flag to the repository", async () => {
    const repository = repositoryMock();
    const service = new LeadService(repository as never);
    await expect(service.list({ includeDeleted: true }, representative)).rejects.toBeInstanceOf(LeadPermissionError);
    await expect(service.list({ includeDeleted: true }, manager)).resolves.toMatchObject({ total: 1 });
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ includeDeleted: true }));
  });

  it("prevents representatives from changing assignment without ownership", async () => {
    const service = new LeadService(repositoryMock() as never);
    await expect(service.update("11111111-1111-4111-8111-111111111111", { assignedTo: "33333333-3333-4333-8333-333333333333" }, representative)).rejects.toBeInstanceOf(LeadPermissionError);
  });

  it("allows only management to list archived leads", async () => {
    const service = new LeadService(repositoryMock() as never);
    await expect(service.listArchived({}, representative)).rejects.toBeInstanceOf(LeadPermissionError);
    await expect(service.listArchived({}, manager)).resolves.toMatchObject({ total: 1 });
  });

  it("rejects inactive users", async () => {
    const service = new LeadService(repositoryMock() as never);
    await expect(service.list({}, { ...representative, isActive: false })).rejects.toBeInstanceOf(LeadPermissionError);
  });

  it("consumes confirmed create and update confirmations only once", async () => {
    const repository = repositoryMock({
      getConfirmationResult: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce("11111111-1111-4111-8111-111111111111"),
      recordConfirmationResult: vi.fn().mockResolvedValue(undefined),
    });
    const service = new LeadService(repository as never);
    const confirmation: LeadConfirmationContext = {
      confirmationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      submissionHash: "a".repeat(64),
      actorId: representative.userId,
      operation: "create",
    };

    await expect(service.createConfirmedDuplicate({ title: "Lead", sourceType: "company_website", discoveredAt: "2026-06-01T00:00:00.000Z" }, representative, confirmation)).resolves.toEqual({ leadId: leadFixture.id });
    await expect(service.createConfirmedDuplicate({ title: "Lead", sourceType: "company_website", discoveredAt: "2026-06-01T00:00:00.000Z" }, representative, confirmation)).resolves.toEqual({ leadId: leadFixture.id });

    const updateConfirmation: LeadConfirmationContext = {
      confirmationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      submissionHash: "b".repeat(64),
      actorId: representative.userId,
      operation: "update",
      leadId: leadFixture.id,
    };
    await expect(service.updateConfirmedDuplicate(leadFixture.id, { title: "Updated" }, representative, updateConfirmation)).resolves.toEqual({ leadId: leadFixture.id });
  });
});
