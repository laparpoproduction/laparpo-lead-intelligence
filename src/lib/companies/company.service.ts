import { isLikelyDuplicateCompany } from "./duplicate";
import type { CompanyRepository } from "./company.repository";
import type {
  Company,
  CompanyActor,
  CompanyListOptions,
  CompanyLookupOptions,
  CreateCompanyInput,
  PaginatedCompanies,
  UpdateCompanyInput,
  ValidatedCreateCompanyInput,
} from "./company.types";
import {
  validateCompanyCreate,
  validateCompanyFingerprint,
  validateCompanyId,
  validateCompanyListOptions,
  validateCompanyUpdate,
} from "./company.validation";

export class CompanyPermissionError extends Error {
  constructor(message = "Not permitted to access this company") {
    super(message);
    this.name = "CompanyPermissionError";
  }
}

export class CompanyNotFoundError extends Error {
  constructor() {
    super("Company not found");
    this.name = "CompanyNotFoundError";
  }
}

export class CompanyDuplicateError extends Error {
  constructor(readonly candidateIds: string[]) {
    super("A likely duplicate company already exists");
    this.name = "CompanyDuplicateError";
  }
}

const managementRoles = new Set(["ceo_admin", "sales_manager"]);

function isManagement(actor: CompanyActor): boolean {
  return managementRoles.has(actor.role);
}

function duplicateInput(company: Company | ValidatedCreateCompanyInput | UpdateCompanyInput) {
  return {
    companyName:
      "displayName" in company && company.displayName ? company.displayName : "",
    websiteUrl: "websiteUrl" in company ? company.websiteUrl : null,
    publicPhone: "publicPhone" in company ? company.publicPhone : null,
    city: "city" in company ? company.city : null,
    state: "state" in company ? company.state : null,
    country: "country" in company ? company.country : null,
  };
}

export class CompanyService {
  constructor(private readonly repository: CompanyRepository) {}

  async create(input: CreateCompanyInput, actor: CompanyActor): Promise<Company> {
    return this.createInternal(input, actor, true);
  }

  async createConfirmedDuplicate(
    input: CreateCompanyInput,
    actor: CompanyActor,
  ): Promise<Company> {
    return this.createInternal(input, actor, false);
  }

  private async createInternal(
    input: CreateCompanyInput,
    actor: CompanyActor,
    verifyDuplicate: boolean,
  ): Promise<Company> {
    this.requireActive(actor);
    const validated = validateCompanyCreate(input);
    if (verifyDuplicate) await this.verifyNoDuplicate(validated);
    return this.repository.create(validated, actor.userId);
  }

  async getById(id: string, actor: CompanyActor): Promise<Company> {
    this.requireActive(actor);
    const validatedId = validateCompanyId(id);
    await this.requireCompanyAccess(validatedId, actor);
    const company = await this.repository.getById(validatedId);
    if (!company) throw new CompanyNotFoundError();
    return company;
  }

  async findByFingerprint(
    fingerprint: string,
    actor: CompanyActor,
    options: CompanyLookupOptions = {},
  ): Promise<Company[]> {
    this.requireActive(actor);
    this.requireDeletedLookupPermission(options, actor);
    const companies = await this.repository.findByFingerprint(
      validateCompanyFingerprint(fingerprint),
      options,
    );
    await Promise.all(companies.map((company) => this.requireCompanyAccess(company.id, actor)));
    return companies;
  }

  async findByDomain(
    domain: string,
    actor: CompanyActor,
    options: CompanyLookupOptions = {},
  ): Promise<Company[]> {
    this.requireActive(actor);
    this.requireDeletedLookupPermission(options, actor);
    const companies = await this.repository.findByDomain(domain, options);
    await Promise.all(companies.map((company) => this.requireCompanyAccess(company.id, actor)));
    return companies;
  }

  async list(
    options: CompanyListOptions,
    actor: CompanyActor,
  ): Promise<PaginatedCompanies> {
    this.requireActive(actor);
    const validated = validateCompanyListOptions(options);
    if (validated.includeDeleted && !isManagement(actor)) {
      throw new CompanyPermissionError("Only management can list deleted companies");
    }
    return this.repository.list(validated);
  }

  async search(
    options: CompanyListOptions,
    actor: CompanyActor,
  ): Promise<PaginatedCompanies> {
    this.requireActive(actor);
    const validated = validateCompanyListOptions(options);
    if (validated.includeDeleted && !isManagement(actor)) {
      throw new CompanyPermissionError("Only management can search deleted companies");
    }
    return this.repository.search(validated);
  }

  async update(id: string, input: UpdateCompanyInput, actor: CompanyActor): Promise<Company> {
    return this.updateInternal(id, input, actor, true);
  }

  async updateConfirmedDuplicate(
    id: string,
    input: UpdateCompanyInput,
    actor: CompanyActor,
  ): Promise<Company> {
    return this.updateInternal(id, input, actor, false);
  }

  private async updateInternal(
    id: string,
    input: UpdateCompanyInput,
    actor: CompanyActor,
    verifyDuplicate: boolean,
  ): Promise<Company> {
    this.requireActive(actor);
    const validatedId = validateCompanyId(id);
    await this.requireCompanyAccess(validatedId, actor);
    const current = await this.repository.getById(validatedId);
    if (!current) throw new CompanyNotFoundError();

    const validated = validateCompanyUpdate(input, current.country);
    if (verifyDuplicate && this.identityChanged(validated)) {
      const merged = { ...current, ...validated };
      await this.verifyNoDuplicate(merged, current.id);
    }
    return this.repository.update(validatedId, validated);
  }

  async softDelete(id: string, actor: CompanyActor): Promise<void> {
    this.requireActive(actor);
    const validatedId = validateCompanyId(id);
    const company = await this.repository.getById(validatedId);
    if (!company) throw new CompanyNotFoundError();
    if (!isManagement(actor)) {
      throw new CompanyPermissionError("Only management can delete companies");
    }
    await this.repository.softDelete(validatedId);
  }

  private requireActive(actor: CompanyActor): void {
    validateCompanyId(actor.userId);
    if (!actor.isActive) throw new CompanyPermissionError("Inactive users cannot manage companies");
  }

  private async requireCompanyAccess(id: string, actor: CompanyActor): Promise<void> {
    if (isManagement(actor)) return;
    if (!(await this.repository.canAccess(id))) throw new CompanyPermissionError();
  }

  private identityChanged(input: UpdateCompanyInput): boolean {
    return ["displayName", "websiteUrl", "publicPhone", "city", "state", "country"].some(
      (field) => field in input,
    );
  }

  private requireDeletedLookupPermission(
    options: CompanyLookupOptions,
    actor: CompanyActor,
  ): void {
    if (options.includeDeleted && !isManagement(actor)) {
      throw new CompanyPermissionError("Only management can include deleted companies");
    }
  }

  private async verifyNoDuplicate(
    input: Company | ValidatedCreateCompanyInput,
    excludeId?: string,
  ): Promise<void> {
    const candidates = await this.repository.findDuplicateCandidates(duplicateInput(input));
    const duplicateIds = candidates
      .filter((candidate) => candidate.id !== excludeId)
      .filter((candidate) =>
        isLikelyDuplicateCompany(duplicateInput(input), duplicateInput(candidate)),
      )
      .map((candidate) => candidate.id);

    if (duplicateIds.length > 0) throw new CompanyDuplicateError(duplicateIds);
  }
}
