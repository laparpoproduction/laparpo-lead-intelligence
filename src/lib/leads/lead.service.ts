import { ZodError } from "zod";
import { isLikelyDuplicateLead } from "./lead-normalization";
import { LeadRepositoryNotFoundError, type LeadRepository } from "./lead.repository";
import type {
  Lead,
  LeadActor,
  LeadConfirmationContext,
  LeadListOptions,
  PaginatedLeads,
  UpdateLeadInput,
  CreateLeadInput,
  ValidatedCreateLeadInput,
} from "./lead.types";
import {
  validateLeadCreate,
  validateLeadId,
  validateLeadListOptions,
  validateLeadUpdate,
} from "./lead.validation";

export class LeadPermissionError extends Error {
  constructor(message = "Not permitted to access this lead") {
    super(message);
    this.name = "LeadPermissionError";
  }
}

export class LeadNotFoundError extends Error {
  constructor() {
    super("Lead not found");
    this.name = "LeadNotFoundError";
  }
}

export class LeadDuplicateError extends Error {
  constructor(readonly candidateIds: string[]) {
    super("A likely duplicate lead already exists");
    this.name = "LeadDuplicateError";
  }
}

export class LeadValidationError extends Error {
  constructor(readonly issues: ZodError["issues"], cause?: unknown) {
    super("Lead data is invalid", { cause });
    this.name = "LeadValidationError";
  }
}

const managementRoles = new Set(["ceo_admin", "sales_manager"]);
const identityFields = new Set<keyof UpdateLeadInput>([
  "companyId",
  "primaryContactId",
  "title",
  "serviceInterest",
  "sourceUrl",
  "sourceCampaign",
  "sourceSignalId",
]);

function isManagement(actor: LeadActor): boolean {
  return managementRoles.has(actor.role);
}

function duplicateInput(lead: Lead | ValidatedCreateLeadInput | UpdateLeadInput) {
  return {
    title: "title" in lead && lead.title ? lead.title : "",
    companyId: "companyId" in lead ? lead.companyId : null,
    primaryContactId: "primaryContactId" in lead ? lead.primaryContactId : null,
    serviceInterest: "serviceInterest" in lead ? lead.serviceInterest : null,
    sourceUrl: "sourceUrl" in lead ? lead.sourceUrl : null,
    sourceCampaign: "sourceCampaign" in lead ? lead.sourceCampaign : null,
    sourceSignalId: "sourceSignalId" in lead ? lead.sourceSignalId : null,
  };
}

export class LeadService {
  constructor(private readonly repository: LeadRepository) {}

  async create(input: CreateLeadInput, actor: LeadActor): Promise<Lead> {
    this.requireActive(actor);
    const validated = this.validate(() => validateLeadCreate(input));
    this.requireCreateAssignment(validated, actor);
    await this.verifyNoDuplicate(validated);
    return this.repository.create(validated, actor.userId);
  }

  async createConfirmedDuplicate(
    input: CreateLeadInput,
    actor: LeadActor,
    confirmation: LeadConfirmationContext,
  ): Promise<{ leadId: string }> {
    this.requireActive(actor);
    if (confirmation.operation !== "create" || confirmation.leadId !== undefined) {
      throw new LeadPermissionError("Invalid create confirmation binding");
    }

    const existing = await this.repository.getConfirmationResult?.(confirmation, actor.userId);
    if (existing) return { leadId: existing };

    const validated = this.validate(() => validateLeadCreate(input));
    this.requireCreateAssignment(validated, actor);
    await this.verifyNoDuplicate(validated);
    const created = await this.repository.create(validated, actor.userId);
    await this.repository.recordConfirmationResult?.(confirmation, actor.userId, created.id);
    return { leadId: created.id };
  }

  async getById(id: string, actor: LeadActor): Promise<Lead> {
    this.requireActive(actor);
    const validatedId = this.leadId(id);
    const canAccess = await this.repository.canAccess(validatedId);
    if (!canAccess && !isManagement(actor)) {
      throw new LeadPermissionError();
    }
    const lead = await this.repository.getById(validatedId);
    if (!lead) throw new LeadNotFoundError();
    return lead;
  }

  async list(options: LeadListOptions, actor: LeadActor): Promise<PaginatedLeads> {
    this.requireActive(actor);
    const validated = this.validate(() => validateLeadListOptions(options));
    if (validated.includeDeleted && !isManagement(actor)) {
      throw new LeadPermissionError("Only management can list deleted leads");
    }
    return this.repository.list(validated);
  }

  async search(options: LeadListOptions, actor: LeadActor): Promise<PaginatedLeads> {
    this.requireActive(actor);
    const validated = this.validate(() => validateLeadListOptions(options));
    if (validated.includeDeleted && !isManagement(actor)) {
      throw new LeadPermissionError("Only management can search deleted leads");
    }
    return this.repository.search(validated);
  }

  async update(id: string, input: UpdateLeadInput, actor: LeadActor): Promise<Lead> {
    this.requireActive(actor);
    const validatedId = this.leadId(id);
    const current = await this.repository.getById(validatedId);
    if (!current) throw new LeadNotFoundError();
    this.requireUpdateAccess(current, actor);

    const validated = this.validate(() => validateLeadUpdate(input));
    this.requireRepresentativeMutation(current, validated, actor);
    if (Object.keys(validated).some((field) => identityFields.has(field as keyof UpdateLeadInput))) {
      const merged = { ...current, ...validated };
      await this.verifyNoDuplicate(merged, current.id);
    }

    try {
      return await this.repository.update(validatedId, validated);
    } catch (error) {
      if (error instanceof LeadRepositoryNotFoundError) throw new LeadNotFoundError();
      throw error;
    }
  }

  async updateConfirmedDuplicate(
    id: string,
    input: UpdateLeadInput,
    actor: LeadActor,
    confirmation: LeadConfirmationContext,
  ): Promise<{ leadId: string }> {
    this.requireActive(actor);
    const validatedId = this.leadId(id);
    if (confirmation.operation !== "update" || confirmation.leadId !== validatedId) {
      throw new LeadPermissionError("Invalid update confirmation binding");
    }

    const existing = await this.repository.getConfirmationResult?.(confirmation, actor.userId);
    if (existing) return { leadId: existing };

    const current = await this.repository.getById(validatedId);
    if (!current) throw new LeadNotFoundError();
    this.requireUpdateAccess(current, actor);

    const validated = this.validate(() => validateLeadUpdate(input));
    this.requireRepresentativeMutation(current, validated, actor);
    const updated = await this.repository.update(validatedId, validated);
    await this.repository.recordConfirmationResult?.(confirmation, actor.userId, updated.id);
    return { leadId: updated.id };
  }

  async softDelete(id: string, actor: LeadActor): Promise<void> {
    this.requireActive(actor);
    if (!isManagement(actor)) {
      throw new LeadPermissionError("Only management can delete leads");
    }
    const validatedId = this.leadId(id);
    const lead = await this.repository.getById(validatedId);
    if (!lead) throw new LeadNotFoundError();
    try {
      await this.repository.softDelete(validatedId);
    } catch (error) {
      if (error instanceof LeadRepositoryNotFoundError) throw new LeadNotFoundError();
      throw error;
    }
  }

  async restore(id: string, actor: LeadActor): Promise<void> {
    this.requireActive(actor);
    if (!isManagement(actor)) {
      throw new LeadPermissionError("Only management can restore leads");
    }
    const validatedId = this.leadId(id);
    const lead = await this.repository.getById(validatedId, true);
    if (!lead) throw new LeadNotFoundError();
    try {
      await this.repository.restore(validatedId);
    } catch (error) {
      if (error instanceof LeadRepositoryNotFoundError) throw new LeadNotFoundError();
      throw error;
    }
  }

  async listArchived(options: LeadListOptions, actor: LeadActor): Promise<PaginatedLeads> {
    this.requireActive(actor);
    if (!isManagement(actor)) {
      throw new LeadPermissionError("Only management can access archived leads");
    }
    return this.repository.listArchived(this.validate(() => validateLeadListOptions(options)));
  }

  async listOverdueFollowUps(options: LeadListOptions, actor: LeadActor): Promise<PaginatedLeads> {
    this.requireActive(actor);
    const validated = this.validate(() => validateLeadListOptions(options));
    if (validated.includeDeleted && !isManagement(actor)) {
      throw new LeadPermissionError("Only management can list deleted follow-ups");
    }
    return this.repository.listOverdueFollowUps(validated);
  }

  async listUpcomingFollowUps(options: LeadListOptions, actor: LeadActor): Promise<PaginatedLeads> {
    this.requireActive(actor);
    const validated = this.validate(() => validateLeadListOptions(options));
    if (validated.includeDeleted && !isManagement(actor)) {
      throw new LeadPermissionError("Only management can list deleted follow-ups");
    }
    return this.repository.listUpcomingFollowUps(validated);
  }

  async findByAssignee(userId: string, options: LeadListOptions, actor: LeadActor): Promise<PaginatedLeads> {
    this.requireActive(actor);
    if (!isManagement(actor) && userId !== actor.userId) {
      throw new LeadPermissionError("Representatives can only query their own assigned leads");
    }
    return this.repository.findByAssignee(this.leadId(userId), this.validate(() => validateLeadListOptions(options)));
  }

  private requireActive(actor: LeadActor): void {
    try {
      validateLeadId(actor.userId);
    } catch {
      throw new LeadPermissionError("A valid authenticated actor is required");
    }
    if (!actor.isActive) {
      throw new LeadPermissionError("Inactive users cannot access leads");
    }
  }

  private requireCreateAssignment(input: ValidatedCreateLeadInput, actor: LeadActor): void {
    if (!isManagement(actor) && input.assignedTo && input.assignedTo !== actor.userId) {
      throw new LeadPermissionError("Representatives cannot assign leads to another user");
    }
  }

  private requireUpdateAccess(lead: Lead, actor: LeadActor): void {
    if (isManagement(actor)) return;
    if (lead.createdBy !== actor.userId && lead.assignedTo !== actor.userId) {
      throw new LeadPermissionError("Lead access is read-only for company-derived records");
    }
  }

  private requireRepresentativeMutation(current: Lead, update: UpdateLeadInput, actor: LeadActor): void {
    if (isManagement(actor)) return;

    if ("companyId" in update && update.companyId !== current.companyId) {
      throw new LeadPermissionError("Representatives cannot change a lead company");
    }

    if (!("assignedTo" in update) || update.assignedTo === current.assignedTo) return;

    const selfAssignment =
      current.assignedTo === null &&
      current.createdBy === actor.userId &&
      update.assignedTo === actor.userId;
    if (!selfAssignment) {
      throw new LeadPermissionError("Representatives cannot change this lead assignment");
    }
  }

  private async verifyNoDuplicate(input: Lead | ValidatedCreateLeadInput, excludeId?: string): Promise<void> {
    const target = duplicateInput(input);
    const candidates = await this.repository.findDuplicateCandidates(target);
    const candidateIds = candidates
      .filter((candidate) => candidate.id !== excludeId)
      .filter((candidate) => isLikelyDuplicateLead(target, candidate))
      .map((candidate) => candidate.id);

    if (candidateIds.length > 0) throw new LeadDuplicateError(candidateIds);
  }

  private leadId(value: string): string {
    return this.validate(() => validateLeadId(value));
  }

  private validate<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof ZodError) throw new LeadValidationError(error.issues, error);
      throw error;
    }
  }
}
