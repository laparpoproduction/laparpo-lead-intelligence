import { ZodError } from "zod";
import {
  OpportunityRepositoryError,
  type OpportunityRepository,
} from "./opportunity.repository";
import type {
  ConvertLeadInput,
  LeadConversionActor,
  LeadConversionRecord,
  LeadConversionResult,
  Opportunity,
  OpportunityListOptions,
  PaginatedOpportunities,
} from "./opportunity.types";
import {
  validateLeadConversion,
  validateOpportunityId,
  validateOpportunityListOptions,
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
