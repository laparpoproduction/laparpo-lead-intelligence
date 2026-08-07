import { ZodError } from "zod";
import {
  OpportunityRepositoryError,
  type OpportunityRepository,
} from "./opportunity.repository";
import {
  OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT,
  opportunityPipelineStageValues,
} from "./opportunity.types";
import type {
  ConvertLeadInput,
  LeadConversionActor,
  LeadConversionRecord,
  LeadConversionResult,
  Opportunity,
  OpportunityExpectedCloseMutationInput,
  OpportunityDetail,
  OpportunityListOptions,
  OpportunityLostMutationInput,
  OpportunityMutationResult,
  OpportunityOwnerMutationInput,
  OpportunityOwnerProfile,
  OpportunityPipelineBoard,
  OpportunityPipelineFilters,
  OpportunityPipelineSummaryReadModel,
  OpportunityProbabilityMutationInput,
  OpportunityStageMutationInput,
  OpportunityVersionedMutationInput,
  PaginatedOpportunities,
} from "./opportunity.types";
import {
  validateLeadConversion,
  validateOpportunityExpectedCloseMutation,
  validateOpportunityId,
  validateOpportunityListOptions,
  validateOpportunityLostMutation,
  validateOpportunityMutationVersion,
  validateOpportunityOwnerMutation,
  validateOpportunityProbabilityMutation,
  validateOpportunityStageMutation,
} from "./opportunity.validation";

export class LeadConversionPermissionError extends Error {
  constructor(message = "Lead conversion is not permitted") {
    super(message);
    this.name = "LeadConversionPermissionError";
  }
}

export class LeadConversionNotFoundError extends Error {
  constructor() {
    super("Lead not found");
    this.name = "LeadConversionNotFoundError";
  }
}

export class LeadConversionEligibilityError extends Error {
  constructor(readonly reason: "terminal" | "legacy" | "conflict") {
    super("Lead is not eligible for conversion");
    this.name = "LeadConversionEligibilityError";
  }
}

export class LeadConversionValidationError extends Error {
  constructor(readonly issues: ZodError["issues"], cause?: unknown) {
    super("Lead conversion data is invalid", { cause });
    this.name = "LeadConversionValidationError";
  }
}

export class LeadConversionUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Lead conversion is temporarily unavailable", { cause });
    this.name = "LeadConversionUnavailableError";
  }
}

export class OpportunityListValidationError extends Error {
  constructor(readonly issues: ZodError["issues"], cause?: unknown) {
    super("Opportunity list options are invalid", { cause });
    this.name = "OpportunityListValidationError";
  }
}

export class OpportunityListUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Opportunities are temporarily unavailable", { cause });
    this.name = "OpportunityListUnavailableError";
  }
}

export class OpportunityDetailValidationError extends Error {
  constructor(readonly issues: ZodError["issues"], cause?: unknown) {
    super("Opportunity ID is invalid", { cause });
    this.name = "OpportunityDetailValidationError";
  }
}

export class OpportunityDetailUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Opportunity detail is temporarily unavailable", { cause });
    this.name = "OpportunityDetailUnavailableError";
  }
}

export class OpportunityMutationPermissionError extends Error {
  constructor(message = "Opportunity mutation is not permitted") {
    super(message);
    this.name = "OpportunityMutationPermissionError";
  }
}

export class OpportunityMutationNotFoundError extends Error {
  constructor() {
    super("Opportunity not found");
    this.name = "OpportunityMutationNotFoundError";
  }
}

export class OpportunityMutationConflictError extends Error {
  constructor() {
    super("Opportunity changed after this mutation was prepared");
    this.name = "OpportunityMutationConflictError";
  }
}

export class OpportunityMutationEligibilityError extends Error {
  constructor(readonly reason: "terminal" | "owner_inactive") {
    super("Opportunity is not eligible for this mutation");
    this.name = "OpportunityMutationEligibilityError";
  }
}

export class OpportunityMutationValidationError extends Error {
  constructor(readonly issues: ZodError["issues"], cause?: unknown) {
    super("Opportunity mutation data is invalid", { cause });
    this.name = "OpportunityMutationValidationError";
  }
}

export class OpportunityMutationUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Opportunity mutation is temporarily unavailable", { cause });
    this.name = "OpportunityMutationUnavailableError";
  }
}

const managementRoles = new Set(["ceo_admin", "sales_manager"]);
export const OPPORTUNITY_PIPELINE_PAGE_SIZE = 25;

function isManagement(actor: LeadConversionActor): boolean {
  return managementRoles.has(actor.role);
}

export class LeadConversionService {
  constructor(private readonly repository: OpportunityRepository) {}

  async convert(
    input: ConvertLeadInput,
    actor: LeadConversionActor,
  ): Promise<LeadConversionResult> {
    this.requireActive(actor);
    const validated = this.validate(() => validateLeadConversion(input));
    try {
      return await this.repository.convert(validated);
    } catch (error) {
      if (!(error instanceof OpportunityRepositoryError)) throw error;
      switch (error.failure) {
        case "not_found":
          throw new LeadConversionNotFoundError();
        case "permission_denied":
        case "inactive_actor":
          throw new LeadConversionPermissionError();
        case "terminal_lead":
          throw new LeadConversionEligibilityError("terminal");
        case "legacy_conversion_unresolved":
          throw new LeadConversionEligibilityError("legacy");
        case "conversion_state_conflict":
          throw new LeadConversionEligibilityError("conflict");
        case "unsupported_service":
        case "invalid_value":
          throw new LeadConversionValidationError([], error);
        default:
          throw new LeadConversionUnavailableError(error);
      }
    }
  }

  async getById(
    id: string,
    actor: LeadConversionActor,
  ): Promise<Opportunity | null> {
    this.requireActive(actor);
    const validatedId = this.validate(() => validateOpportunityId(id));
    return this.repository.getById(validatedId);
  }

  async getDetailById(
    id: string,
    actor: LeadConversionActor,
  ): Promise<OpportunityDetail | null> {
    this.requireActive(actor);
    let validatedId: string;
    try {
      validatedId = validateOpportunityId(id);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new OpportunityDetailValidationError(error.issues, error);
      }
      throw error;
    }
    try {
      return await this.repository.getDetailById(validatedId);
    } catch (error) {
      if (error instanceof OpportunityRepositoryError) {
        throw new OpportunityDetailUnavailableError(error);
      }
      throw error;
    }
  }

  async getConversionByLead(
    leadId: string,
    actor: LeadConversionActor,
  ): Promise<LeadConversionRecord | null> {
    this.requireActive(actor);
    const validatedId = this.validate(() => validateOpportunityId(leadId));
    try {
      return await this.repository.getConversionByLead(validatedId);
    } catch (error) {
      if (
        error instanceof OpportunityRepositoryError &&
        error.failure === "permission_denied"
      ) {
        throw new LeadConversionPermissionError();
      }
      if (error instanceof OpportunityRepositoryError) {
        throw new LeadConversionUnavailableError(error);
      }
      throw error;
    }
  }

  async listByLead(
    leadId: string,
    actor: LeadConversionActor,
  ): Promise<Opportunity[]> {
    this.requireActive(actor);
    const validatedId = this.validate(() => validateOpportunityId(leadId));
    return this.repository.listByLead(validatedId);
  }

  async list(
    options: OpportunityListOptions,
    actor: LeadConversionActor,
  ): Promise<PaginatedOpportunities> {
    this.requireActive(actor);
    let validated;
    try {
      validated = validateOpportunityListOptions(options);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new OpportunityListValidationError(error.issues, error);
      }
      throw error;
    }
    try {
      return await this.repository.list(validated);
    } catch (error) {
      if (error instanceof OpportunityRepositoryError) {
        throw new OpportunityListUnavailableError(error);
      }
      throw error;
    }
  }

  async listPipeline(
    filters: OpportunityPipelineFilters,
    actor: LeadConversionActor,
  ): Promise<OpportunityPipelineBoard> {
    this.requireActive(actor);
    let validated: ReturnType<typeof validateOpportunityListOptions>;
    try {
      validated = validateOpportunityListOptions({
        ...filters,
        sort: "newest",
        page: 1,
        pageSize: OPPORTUNITY_PIPELINE_PAGE_SIZE,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        throw new OpportunityListValidationError(error.issues, error);
      }
      throw error;
    }

    try {
      const [stageResults, ownerProfiles] = await Promise.all([
        Promise.all(
          opportunityPipelineStageValues.map((pipelineStage) =>
            this.repository.list({
              ...validated,
              pipelineStage,
            }),
          ),
        ),
        this.repository.listOwnerProfiles(),
      ]);
      const items = stageResults.flatMap((result) => result.items);
      const mutableLeadIds = isManagement(actor)
        ? new Set(items.map((item) => item.leadId))
        : await this.representativeMutableLeadIds(
            items.map((item) => item.leadId),
            actor,
          );

      return {
        columns: opportunityPipelineStageValues.map((stage, index) => ({
          stage,
          total: stageResults[index]!.total,
          items: stageResults[index]!.items.map((item) => ({
            ...item,
            canModify: mutableLeadIds.has(item.leadId),
          })),
        })),
        ownerProfiles,
      };
    } catch (error) {
      if (error instanceof OpportunityRepositoryError) {
        throw new OpportunityListUnavailableError(error);
      }
      throw error;
    }
  }

  async listOwnerProfiles(
    actor: LeadConversionActor,
  ): Promise<OpportunityOwnerProfile[]> {
    this.requireActive(actor);
    try {
      return await this.repository.listOwnerProfiles();
    } catch (error) {
      if (error instanceof OpportunityRepositoryError) {
        throw new OpportunityListUnavailableError(error);
      }
      throw error;
    }
  }

  async getPipelineSummaryReadModel(
    actor: LeadConversionActor,
  ): Promise<OpportunityPipelineSummaryReadModel> {
    this.requireActive(actor);
    try {
      return await this.repository.getPipelineSummaryReadModel(
        OPPORTUNITY_PIPELINE_SUMMARY_ROW_LIMIT,
      );
    } catch (error) {
      if (error instanceof OpportunityRepositoryError) {
        throw new OpportunityListUnavailableError(error);
      }
      throw error;
    }
  }

  async canModifyLeadForUi(
    leadId: string,
    actor: LeadConversionActor,
  ): Promise<boolean> {
    this.requireActive(actor);
    const validatedId = this.validate(() => validateOpportunityId(leadId));
    try {
      return await this.repository.canModifyLead(validatedId);
    } catch (error) {
      if (error instanceof OpportunityRepositoryError) {
        throw new OpportunityDetailUnavailableError(error);
      }
      throw error;
    }
  }

  async changePipelineStage(
    input: OpportunityStageMutationInput,
    actor: LeadConversionActor,
  ): Promise<OpportunityMutationResult> {
    this.requireMutationActor(actor);
    const validated = this.validateMutation(() =>
      validateOpportunityStageMutation(input),
    );
    return this.mutate(
      validated,
      actor,
      (opportunity) =>
        opportunity.pipelineStage === validated.pipelineStage,
      (opportunity) => this.requireActivePipeline(opportunity),
      () => this.repository.changePipelineStage(validated),
    );
  }

  async assignOwner(
    input: OpportunityOwnerMutationInput,
    actor: LeadConversionActor,
  ): Promise<OpportunityMutationResult> {
    this.requireMutationActor(actor);
    const validated = this.validateMutation(() =>
      validateOpportunityOwnerMutation(input),
    );
    if (!isManagement(actor) && validated.ownerId !== actor.userId) {
      throw new OpportunityMutationPermissionError(
        "Representatives may only claim an unassigned Opportunity as themselves",
      );
    }
    return this.mutate(
      validated,
      actor,
      (opportunity) => opportunity.ownerId === validated.ownerId,
      (opportunity) => {
        if (
          !isManagement(actor) &&
          opportunity.ownerId !== null &&
          opportunity.ownerId !== actor.userId
        ) {
          throw new OpportunityMutationPermissionError(
            "Representatives cannot hijack an owned Opportunity",
          );
        }
      },
      () => this.repository.assignOwner(validated),
    );
  }

  async setExpectedCloseDate(
    input: OpportunityExpectedCloseMutationInput,
    actor: LeadConversionActor,
  ): Promise<OpportunityMutationResult> {
    this.requireMutationActor(actor);
    const validated = this.validateMutation(() =>
      validateOpportunityExpectedCloseMutation(input),
    );
    return this.mutate(
      validated,
      actor,
      (opportunity) =>
        opportunity.expectedCloseDate === validated.expectedCloseDate,
      () => undefined,
      () => this.repository.setExpectedCloseDate(validated),
    );
  }

  async overrideProbability(
    input: OpportunityProbabilityMutationInput,
    actor: LeadConversionActor,
  ): Promise<OpportunityMutationResult> {
    this.requireMutationActor(actor);
    this.requireManagement(actor);
    const validated = this.validateMutation(() =>
      validateOpportunityProbabilityMutation(input),
    );
    return this.mutate(
      validated,
      actor,
      (opportunity) =>
        opportunity.probabilityOverridden &&
        opportunity.probabilityPercent === validated.probabilityPercent,
      (opportunity) => this.requireActivePipeline(opportunity),
      () => this.repository.overrideProbability(validated),
    );
  }

  async clearProbabilityOverride(
    input: OpportunityVersionedMutationInput,
    actor: LeadConversionActor,
  ): Promise<OpportunityMutationResult> {
    this.requireMutationActor(actor);
    this.requireManagement(actor);
    const validated = this.validateMutation(() =>
      validateOpportunityMutationVersion(input),
    );
    return this.mutate(
      validated,
      actor,
      (opportunity) => !opportunity.probabilityOverridden,
      (opportunity) => this.requireActivePipeline(opportunity),
      () => this.repository.clearProbabilityOverride(validated),
    );
  }

  async markWon(
    input: OpportunityVersionedMutationInput,
    actor: LeadConversionActor,
  ): Promise<OpportunityMutationResult> {
    this.requireMutationActor(actor);
    const validated = this.validateMutation(() =>
      validateOpportunityMutationVersion(input),
    );
    return this.mutate(
      validated,
      actor,
      (opportunity) => opportunity.pipelineStage === "won",
      (opportunity) => this.requireActivePipeline(opportunity),
      () => this.repository.markWon(validated),
    );
  }

  async markLost(
    input: OpportunityLostMutationInput,
    actor: LeadConversionActor,
  ): Promise<OpportunityMutationResult> {
    this.requireMutationActor(actor);
    const validated = this.validateMutation(() =>
      validateOpportunityLostMutation(input),
    );
    return this.mutate(
      validated,
      actor,
      (opportunity) =>
        opportunity.pipelineStage === "lost" &&
        opportunity.lostReason === validated.lostReason &&
        opportunity.lostReasonNotes === validated.lostReasonNotes,
      (opportunity) => this.requireActivePipeline(opportunity),
      () => this.repository.markLost(validated),
    );
  }

  private requireActive(actor: LeadConversionActor): void {
    try {
      validateOpportunityId(actor.userId);
    } catch {
      throw new LeadConversionPermissionError(
        "A valid authenticated actor is required",
      );
    }
    if (!actor.isActive) {
      throw new LeadConversionPermissionError(
        "Inactive users cannot access Opportunities",
      );
    }
  }

  private async representativeMutableLeadIds(
    leadIds: string[],
    actor: LeadConversionActor,
  ): Promise<Set<string>> {
    const rows = await this.repository.listLeadAccessRows(leadIds);
    return new Set(
      rows
        .filter(
          (row) =>
            row.created_by === actor.userId ||
            row.assigned_to === actor.userId,
        )
        .map((row) => row.id),
    );
  }

  private requireMutationActor(actor: LeadConversionActor): void {
    try {
      validateOpportunityId(actor.userId);
    } catch {
      throw new OpportunityMutationPermissionError(
        "A valid authenticated actor is required",
      );
    }
    if (!actor.isActive) {
      throw new OpportunityMutationPermissionError(
        "Inactive users cannot mutate Opportunities",
      );
    }
  }

  private requireManagement(actor: LeadConversionActor): void {
    if (!isManagement(actor)) {
      throw new OpportunityMutationPermissionError(
        "Only sales management can change Opportunity probability overrides",
      );
    }
  }

  private requireActivePipeline(opportunity: Opportunity): void {
    if (
      opportunity.pipelineStage === "won" ||
      opportunity.pipelineStage === "lost"
    ) {
      throw new OpportunityMutationEligibilityError("terminal");
    }
  }

  private async mutate(
    input: OpportunityVersionedMutationInput,
    actor: LeadConversionActor,
    isApplied: (opportunity: Opportunity) => boolean,
    requireEligible: (opportunity: Opportunity) => void,
    operation: () => Promise<Opportunity | null>,
  ): Promise<OpportunityMutationResult> {
    const current = await this.mutationRead(input.opportunityId);
    if (!current) throw new OpportunityMutationNotFoundError();

    let canModify: boolean;
    try {
      canModify = await this.repository.canModifyLead(current.leadId);
    } catch (error) {
      this.mapMutationRepositoryError(error);
    }
    if (!canModify!) {
      throw new OpportunityMutationPermissionError(
        "Read access does not grant Opportunity mutation access",
      );
    }

    if (isApplied(current)) {
      return { status: "already_applied", opportunity: current };
    }
    if (current.updatedAt !== input.expectedUpdatedAt) {
      throw new OpportunityMutationConflictError();
    }
    requireEligible(current);

    let updated: Opportunity | null;
    try {
      updated = await operation();
    } catch (error) {
      this.mapMutationRepositoryError(error);
    }
    if (updated!) return { status: "applied", opportunity: updated };

    const fresh = await this.mutationRead(input.opportunityId);
    if (!fresh) throw new OpportunityMutationNotFoundError();
    if (isApplied(fresh)) {
      return { status: "already_applied", opportunity: fresh };
    }
    if (fresh.updatedAt !== input.expectedUpdatedAt) {
      throw new OpportunityMutationConflictError();
    }
    throw new OpportunityMutationPermissionError();
  }

  private async mutationRead(id: string): Promise<Opportunity | null> {
    try {
      return await this.repository.getById(id);
    } catch (error) {
      this.mapMutationRepositoryError(error);
    }
  }

  private mapMutationRepositoryError(error: unknown): never {
    if (!(error instanceof OpportunityRepositoryError)) {
      throw new OpportunityMutationUnavailableError();
    }
    switch (error.failure) {
      case "not_found":
        throw new OpportunityMutationNotFoundError();
      case "permission_denied":
      case "inactive_actor":
      case "owner_forbidden":
      case "probability_forbidden":
        throw new OpportunityMutationPermissionError();
      case "stale_conflict":
        throw new OpportunityMutationConflictError();
      case "terminal":
        throw new OpportunityMutationEligibilityError("terminal");
      case "owner_inactive":
        throw new OpportunityMutationEligibilityError("owner_inactive");
      case "probability_invalid":
      case "lost_reason_required":
      case "lost_notes_required":
      case "invalid_value":
        throw new OpportunityMutationValidationError([], error);
      default:
        throw new OpportunityMutationUnavailableError(error);
    }
  }

  private validateMutation<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new OpportunityMutationValidationError(error.issues, error);
      }
      throw error;
    }
  }

  private validate<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new LeadConversionValidationError(error.issues, error);
      }
      throw error;
    }
  }
}
