import { describe, expect, it, vi } from "vitest";
import type { ContactRepository } from "./contact.repository";
import {
  ContactDuplicateError,
  ContactPermissionError,
  ContactService,
} from "./contact.service";
import {
  assigneeId,
  companyId,
  contactFixture,
  contactId,
  creatorId,
  unrelatedId,
} from "./contact.test-fixtures";
import type { ContactActor, ContactDuplicateCandidate } from "./contact.types";

const creator: ContactActor = {
  userId: creatorId,
  role: "sales_representative",
  isActive: true,
};
const assignee: ContactActor = {
  userId: assigneeId,
  role: "sales_representative",
  isActive: true,
};
const unrelated: ContactActor = {
  userId: unrelatedId,
  role: "sales_representative",
  isActive: true,
};
const manager: ContactActor = {
  userId: unrelatedId,
  role: "sales_manager",
  isActive: true,
};

const page = {
  items: [contactFixture],
  page: 1,
  pageSize: 25,
  total: 1,
  totalPages: 1,
};

function repositoryMock(overrides: Partial<ContactRepository> = {}): ContactRepository {
  return {
    create: vi.fn().mockResolvedValue(contactFixture),
    createConfirmed: vi.fn().mockResolvedValue({ status: "applied", contactId }),
    getById: vi.fn().mockResolvedValue(contactFixture),
    list: vi.fn().mockResolvedValue(page),
    search: vi.fn().mockResolvedValue(page),
    update: vi.fn().mockResolvedValue(contactFixture),
    updateConfirmed: vi.fn().mockResolvedValue({ status: "applied", contactId }),
    softDelete: vi.fn().mockResolvedValue(undefined),
    findDuplicateCandidates: vi.fn().mockResolvedValue([]),
    listArchived: vi.fn().mockResolvedValue(page),
    findByCompany: vi.fn().mockResolvedValue(page),
    findByAssignee: vi.fn().mockResolvedValue(page),
    findByCreator: vi.fn().mockResolvedValue(page),
    ...overrides,
  };
}

const createInput = {
  companyId,
  fullName: "Nur Aisyah binti Ahmad",
  workEmail: "aisyah@example.my",
  sourceUrl: "https://example.my/team/nur-aisyah",
  sourceType: "company_website",
  discoveredAt: "2026-07-10T00:00:00.000Z",
};

const createConfirmation = {
  confirmationId: "77777777-7777-4777-8777-777777777777",
  submissionHash: "a".repeat(64),
  operation: "create" as const,
};

const updateConfirmation = {
  confirmationId: "88888888-8888-4888-8888-888888888888",
  submissionHash: "b".repeat(64),
  operation: "update" as const,
  contactId,
};

describe("ContactService", () => {
  it("normalizes, checks candidates, and creates as the authenticated representative", async () => {
    const repository = repositoryMock();
    await expect(new ContactService(repository).create(createInput, creator)).resolves.toEqual(
      contactFixture,
    );
    expect(repository.findDuplicateCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ workEmail: "aisyah@example.my" }),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ contactStatus: "discovered" }),
      creatorId,
    );
  });

  it("rejects representative creation assigned to another user", async () => {
    const repository = repositoryMock();
    await expect(
      new ContactService(repository).create({ ...createInput, assignedTo: assigneeId }, creator),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("orchestrates confirmed create without weakening assignment rules", async () => {
    const repository = repositoryMock();
    const service = new ContactService(repository);
    await expect(
      service.createConfirmedDuplicate(createInput, creator, createConfirmation),
    ).resolves.toEqual({ status: "applied", contactId });
    expect(repository.findDuplicateCandidates).not.toHaveBeenCalled();
    expect(repository.createConfirmed).toHaveBeenCalledWith(
      expect.objectContaining({ workEmail: "aisyah@example.my" }),
      creatorId,
      createConfirmation,
    );

    await expect(
      service.createConfirmedDuplicate(
        { ...createInput, assignedTo: assigneeId },
        creator,
        createConfirmation,
      ),
    ).rejects.toBeInstanceOf(ContactPermissionError);
  });

  it("returns the repository replay result for confirmed create", async () => {
    const repository = repositoryMock({
      createConfirmed: vi.fn().mockResolvedValue({
        status: "already_processed",
        contactId,
      }),
    });
    await expect(
      new ContactService(repository).createConfirmedDuplicate(
        createInput,
        creator,
        createConfirmation,
      ),
    ).resolves.toEqual({ status: "already_processed", contactId });
  });

  it.each([
    ["email", { workEmail: "aisyah@example.my" }, { personalEmail: "AISYAH@EXAMPLE.MY" }],
    [
      "LinkedIn",
      { workEmail: null, linkedinUrl: "https://linkedin.com/in/same-person" },
      { workEmail: null, linkedinUrl: "https://linkedin.com/in/same-person/" },
    ],
    [
      "WhatsApp",
      { workEmail: null, whatsappPhone: "60125550100" },
      { workEmail: null, whatsappPhone: "+60 12-555 0100" },
    ],
    [
      "same company and normalized name",
      { workEmail: null, fullName: "Nur Aisyah", companyId },
      { workEmail: null, fullName: " nur  aisyah ", companyId },
    ],
  ])("warns on a corroborated duplicate by %s", async (_label, candidatePatch, inputPatch) => {
    const candidate = { ...contactFixture, ...candidatePatch } as ContactDuplicateCandidate;
    const repository = repositoryMock({
      findDuplicateCandidates: vi.fn().mockResolvedValue([candidate]),
    });
    await expect(
      new ContactService(repository).create({ ...createInput, ...inputPatch }, creator),
    ).rejects.toEqual(
      expect.objectContaining<Partial<ContactDuplicateError>>({ candidateIds: [contactId] }),
    );
  });

  it("does not block a shared name at another company or a shared main phone alone", async () => {
    const otherCompany = "66666666-6666-4666-8666-666666666666";
    const nameOnly = repositoryMock({
      findDuplicateCandidates: vi.fn().mockResolvedValue([
        { ...contactFixture, companyId: otherCompany, workEmail: null },
      ]),
    });
    await expect(
      new ContactService(nameOnly).create(
        { ...createInput, workEmail: undefined },
        creator,
      ),
    ).resolves.toEqual(contactFixture);

    const sharedPhone = repositoryMock({
      findDuplicateCandidates: vi.fn().mockResolvedValue([
        { ...contactFixture, fullName: "Different Person", workEmail: null },
      ]),
    });
    await expect(
      new ContactService(sharedPhone).create(
        { ...createInput, workEmail: undefined, publicPhone: contactFixture.publicPhone },
        creator,
      ),
    ).resolves.toEqual(contactFixture);
  });

  it("allows Company-derived read access but keeps it read-only", async () => {
    const repository = repositoryMock();
    const service = new ContactService(repository);
    await expect(service.getById(contactId, unrelated)).resolves.toEqual(contactFixture);
    await expect(service.update(contactId, { notes: "Not allowed" }, unrelated)).rejects.toThrow(
      "Company-derived contact access is read-only",
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("allows a creator and an assignee to update ordinary fields", async () => {
    const creatorRepository = repositoryMock();
    await new ContactService(creatorRepository).update(contactId, { notes: "Creator update" }, creator);
    expect(creatorRepository.update).toHaveBeenCalledWith(contactId, { notes: "Creator update" });

    const assigneeRepository = repositoryMock();
    await new ContactService(assigneeRepository).update(contactId, { notes: "Assignee update" }, assignee);
    expect(assigneeRepository.update).toHaveBeenCalledWith(contactId, { notes: "Assignee update" });
  });

  it("prevents representative company changes and assignment takeover or clearing", async () => {
    const repository = repositoryMock();
    const service = new ContactService(repository);
    await expect(
      service.update(contactId, { companyId: null }, creator),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    await expect(
      service.update(contactId, { assignedTo: null }, creator),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    await expect(
      service.update(contactId, { assignedTo: creatorId }, creator),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("permits creator self-assignment only while unassigned", async () => {
    const current = { ...contactFixture, assignedTo: null };
    const repository = repositoryMock({
      getById: vi.fn().mockResolvedValue(current),
      update: vi.fn().mockResolvedValue({ ...current, assignedTo: creatorId }),
    });
    await new ContactService(repository).update(contactId, { assignedTo: creatorId }, creator);
    expect(repository.update).toHaveBeenCalledWith(contactId, { assignedTo: creatorId });
  });

  it("allows management to change assignment", async () => {
    const repository = repositoryMock();
    await new ContactService(repository).update(contactId, { assignedTo: creatorId }, manager);
    expect(repository.update).toHaveBeenCalledWith(contactId, { assignedTo: creatorId });
  });

  it("keeps permission and assignment checks during confirmed updates", async () => {
    const repository = repositoryMock();
    const service = new ContactService(repository);

    await expect(
      service.updateConfirmedDuplicate(
        contactId,
        { notes: "No access" },
        unrelated,
        updateConfirmation,
      ),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    await expect(
      service.updateConfirmedDuplicate(
        contactId,
        { companyId: null },
        creator,
        updateConfirmation,
      ),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    await expect(
      service.updateConfirmedDuplicate(
        contactId,
        { assignedTo: null },
        creator,
        updateConfirmation,
      ),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    expect(repository.updateConfirmed).not.toHaveBeenCalled();
  });

  it("allows an authorized confirmed update and returns replay state", async () => {
    const repository = repositoryMock({
      updateConfirmed: vi.fn().mockResolvedValue({
        status: "already_processed",
        contactId,
      }),
    });
    await expect(
      new ContactService(repository).updateConfirmedDuplicate(
        contactId,
        { workEmail: "duplicate@example.my" },
        creator,
        updateConfirmation,
      ),
    ).resolves.toEqual({ status: "already_processed", contactId });
    expect(repository.findDuplicateCandidates).not.toHaveBeenCalled();
  });

  it("rejects cross-operation and wrong-contact confirmation bindings", async () => {
    const service = new ContactService(repositoryMock());
    await expect(
      service.createConfirmedDuplicate(createInput, creator, updateConfirmation),
    ).rejects.toBeInstanceOf(ContactPermissionError);
    await expect(
      service.updateConfirmedDuplicate(
        contactId,
        { notes: "Changed" },
        creator,
        { ...updateConfirmation, contactId: companyId },
      ),
    ).rejects.toBeInstanceOf(ContactPermissionError);
  });

  it("checks duplicates only for identity-changing updates and excludes itself", async () => {
    const repository = repositoryMock({
      findDuplicateCandidates: vi.fn().mockResolvedValue([contactFixture]),
    });
    const service = new ContactService(repository);
    await service.update(contactId, { workEmail: "new@example.my" }, creator);
    expect(repository.findDuplicateCandidates).toHaveBeenCalled();

    const ordinary = repositoryMock();
    await new ContactService(ordinary).update(contactId, { notes: "No identity change" }, creator);
    expect(ordinary.findDuplicateCandidates).not.toHaveBeenCalled();
  });

  it("allows only management to soft-delete and list archived Contacts", async () => {
    const repository = repositoryMock();
    const service = new ContactService(repository);
    await expect(service.softDelete(contactId, creator)).rejects.toBeInstanceOf(
      ContactPermissionError,
    );
    await expect(service.listArchived({}, creator)).rejects.toBeInstanceOf(
      ContactPermissionError,
    );
    await expect(service.softDelete(contactId, manager)).resolves.toBeUndefined();
    await expect(service.listArchived({}, manager)).resolves.toEqual(page);
  });

  it("denies inactive actors before repository access", async () => {
    const repository = repositoryMock();
    const inactive = { ...creator, isActive: false };
    await expect(new ContactService(repository).list({}, inactive)).rejects.toBeInstanceOf(
      ContactPermissionError,
    );
    await expect(new ContactService(repository).create(createInput, inactive)).rejects.toBeInstanceOf(
      ContactPermissionError,
    );
    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("orchestrates company, assignee, and creator reads through the repository", async () => {
    const repository = repositoryMock();
    const service = new ContactService(repository);
    await service.findByCompany(companyId, {}, creator);
    await service.findByAssignee(assigneeId, {}, creator);
    await service.findByCreator(creatorId, {}, creator);
    expect(repository.findByCompany).toHaveBeenCalledWith(companyId, expect.any(Object));
    expect(repository.findByAssignee).toHaveBeenCalledWith(assigneeId, expect.any(Object));
    expect(repository.findByCreator).toHaveBeenCalledWith(creatorId, expect.any(Object));
  });
});
