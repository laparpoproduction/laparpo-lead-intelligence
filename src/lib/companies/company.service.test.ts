import { describe, expect, it, vi } from "vitest";
import type { CompanyRepository } from "./company.repository";
import {
  CompanyDuplicateError,
  CompanyPermissionError,
  CompanyService,
} from "./company.service";
import type { CompanyActor } from "./company.types";
import { companyFixture, companyId, userId } from "./company.test-fixtures";

const representative: CompanyActor = {
  userId,
  role: "sales_representative",
  isActive: true,
};
const manager: CompanyActor = {
  userId: "33333333-3333-4333-8333-333333333333",
  role: "sales_manager",
  isActive: true,
};

function repositoryMock(overrides: Partial<CompanyRepository> = {}): CompanyRepository {
  return {
    create: vi.fn().mockResolvedValue(companyFixture),
    getById: vi.fn().mockResolvedValue(companyFixture),
    findByFingerprint: vi.fn().mockResolvedValue([companyFixture]),
    findByDomain: vi.fn().mockResolvedValue([companyFixture]),
    findDuplicateCandidates: vi.fn().mockResolvedValue([]),
    list: vi.fn().mockResolvedValue({ items: [companyFixture], page: 1, pageSize: 25, total: 1, totalPages: 1 }),
    search: vi.fn().mockResolvedValue({ items: [], page: 1, pageSize: 100, total: 0, totalPages: 0 }),
    update: vi.fn().mockResolvedValue(companyFixture),
    softDelete: vi.fn().mockResolvedValue(undefined),
    canAccess: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

const createInput = {
  legalName: "ABC (Malaysia), Sdn Bhd",
  displayName: "ABC (Malaysia)",
  companyType: "fnb" as const,
  websiteUrl: "https://example.my",
  sourceUrl: "https://example.my/contact",
  sourceType: "company_website",
};

describe("CompanyService", () => {
  it("validates, checks duplicates, and creates for an active user", async () => {
    const repository = repositoryMock();
    const service = new CompanyService(repository);
    await expect(service.create(createInput, representative)).resolves.toEqual(companyFixture);
    expect(repository.findDuplicateCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ companyName: "ABC (Malaysia)" }),
    );
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ country: "MY" }), userId);
  });

  it("rejects a corroborated likely duplicate", async () => {
    const repository = repositoryMock({
      findDuplicateCandidates: vi.fn().mockResolvedValue([companyFixture]),
    });
    await expect(new CompanyService(repository).create(createInput, representative)).rejects.toEqual(
      expect.objectContaining<Partial<CompanyDuplicateError>>({ candidateIds: [companyId] }),
    );
  });

  it("checks duplicate candidates beyond the first 100 records", async () => {
    const nonDuplicates = Array.from({ length: 100 }, (_, index) => ({
      ...companyFixture,
      id: `candidate-${index.toString().padStart(3, "0")}`,
      websiteUrl: `https://branch-${index}.example.my`,
      websiteDomain: `branch-${index}.example.my`,
      publicPhone: null,
      city: null,
      state: null,
    }));
    const repository = repositoryMock({
      findDuplicateCandidates: vi
        .fn()
        .mockResolvedValue([...nonDuplicates, companyFixture]),
    });

    await expect(
      new CompanyService(repository).create(createInput, representative),
    ).rejects.toBeInstanceOf(CompanyDuplicateError);
  });

  it("uses repository permission checks for representatives", async () => {
    const denied = repositoryMock({ canAccess: vi.fn().mockResolvedValue(false) });
    await expect(new CompanyService(denied).getById(companyId, representative)).rejects.toBeInstanceOf(
      CompanyPermissionError,
    );

    const allowed = repositoryMock();
    await expect(new CompanyService(allowed).getById(companyId, representative)).resolves.toEqual(
      companyFixture,
    );
  });

  it("returns all permitted domain and fingerprint matches", async () => {
    const secondCompany = {
      ...companyFixture,
      id: "55555555-5555-4555-8555-555555555555",
    };
    const repository = repositoryMock({
      findByDomain: vi.fn().mockResolvedValue([companyFixture, secondCompany]),
      findByFingerprint: vi.fn().mockResolvedValue([companyFixture, secondCompany]),
    });
    const service = new CompanyService(repository);

    await expect(service.findByDomain("example.my", representative)).resolves.toHaveLength(2);
    await expect(
      service.findByFingerprint(companyFixture.fingerprint, representative),
    ).resolves.toHaveLength(2);
    expect(repository.canAccess).toHaveBeenCalledTimes(4);
  });

  it("allows only management to include deleted lookup matches", async () => {
    const repository = repositoryMock();
    const service = new CompanyService(repository);

    await expect(
      service.findByDomain("example.my", representative, { includeDeleted: true }),
    ).rejects.toBeInstanceOf(CompanyPermissionError);
    await expect(
      service.findByDomain("example.my", manager, { includeDeleted: true }),
    ).resolves.toEqual([companyFixture]);
    expect(repository.findByDomain).toHaveBeenLastCalledWith("example.my", {
      includeDeleted: true,
    });
  });

  it("orchestrates an authorised update and excludes the current duplicate candidate", async () => {
    const repository = repositoryMock({
      findDuplicateCandidates: vi.fn().mockResolvedValue([companyFixture]),
    });
    await new CompanyService(repository).update(companyId, { city: "Butterworth" }, representative);
    expect(repository.update).toHaveBeenCalledWith(companyId, { city: "Butterworth" });
  });

  it("allows soft delete only for management", async () => {
    const repository = repositoryMock();
    await expect(
      new CompanyService(repository).softDelete(companyId, representative),
    ).rejects.toBeInstanceOf(
      CompanyPermissionError,
    );
    await expect(new CompanyService(repository).softDelete(companyId, manager)).resolves.toBeUndefined();
    expect(repository.softDelete).toHaveBeenCalledTimes(1);
  });

  it("denies inactive users", async () => {
    await expect(
      new CompanyService(repositoryMock()).list({}, { ...representative, isActive: false }),
    ).rejects.toBeInstanceOf(CompanyPermissionError);
  });

  it("restricts deleted-record listing to management", async () => {
    const repository = repositoryMock();
    await expect(
      new CompanyService(repository).list({ includeDeleted: true }, representative),
    ).rejects.toBeInstanceOf(CompanyPermissionError);
    await expect(
      new CompanyService(repository).list({ includeDeleted: true }, manager),
    ).resolves.toMatchObject({ total: 1 });
  });
});
