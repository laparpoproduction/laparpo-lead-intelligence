import { ZodError } from "zod";
import type { LeadRepository } from "@/lib/leads/lead.repository";
import {
  LeadActivityRepositoryNotFoundError,
  type LeadActivityRepository,
} from "./lead-activity.repository";
import type {
  LeadActivity,
  LeadActivityActor,
  LeadActivityCreateInput,
  LeadActivityListOptions,
  LeadActivityUpdateInput,
  PaginatedLeadActivities,
} from "./lead-activity.types";
import {
  validateLeadActivityCreate,
  validateLeadActivityId,
  validateLeadActivityListOptions,
  validateLeadActivityUpdate,
} from "./lead-activity.validation";

export class LeadActivityPermissionError extends Error {
  constructor(message = "Not permitted to access this Lead activity") {
    super(message);
    this.name = "LeadActivityPermissionError";
  }
}

export class LeadActivityNotFoundError extends Error {
  constructor() {
    super("Lead activity not found");
    this.name = "LeadActivityNotFoundError";
  }
}

export class LeadActivityValidationError extends Error {
  constructor(readonly issues: ZodError["issues"], cause?: unknown) {
    super("Lead activity data is invalid", { cause });
    this.name = "LeadActivityValidationError";
  }
}

const managementRoles = new Set(["ceo_admin", "sales_manager"]);

function isManagement(actor: LeadActivityActor): boolean {
  return managementRoles.has(actor.role);
}

export class LeadActivityService {
  constructor(
    private readonly repository: LeadActivityRepository,
    private readonly leadRepository: Pick<
      LeadRepository,
      "canAccess" | "canModify"
    >,
  ) {}

  async create(
    input: LeadActivityCreateInput,
    actor: LeadActivityActor,
  ): Promise<LeadActivity> {
    this.requireActive(actor);
    const validated = this.validate(() => validateLeadActivityCreate(input));
    await this.requireLeadModify(validated.leadId);
    this.requireCreateAssignment(validated.assignedTo, actor);
    return this.repository.create(validated, actor.userId);
  }

  async getById(
    id: string,
    actor: LeadActivityActor,
  ): Promise<LeadActivity> {
    this.requireActive(actor);
    const activity = await this.repository.getById(this.activityId(id));
    if (!activity) throw new LeadActivityNotFoundError();
    await this.requireLeadAccess(activity.leadId);
    return activity;
  }

  async listByLead(
    leadId: string,
    options: LeadActivityListOptions,
    actor: LeadActivityActor,
  ): Promise<PaginatedLeadActivities> {
    this.requireActive(actor);
    const validatedLeadId = this.activityId(leadId);
    await this.requireLeadAccess(validatedLeadId);
    return this.repository.listByLead(
      validatedLeadId,
      this.validate(() => validateLeadActivityListOptions(options)),
    );
  }

  async update(
    id: string,
    input: LeadActivityUpdateInput,
    actor: LeadActivityActor,
  ): Promise<LeadActivity> {
    this.requireActive(actor);
    const validatedId = this.activityId(id);
    const current = await this.repository.getById(validatedId);
    if (!current) throw new LeadActivityNotFoundError();
    await this.requireLeadModify(current.leadId);
    this.requireActivityOwnership(current, actor);
    const validated = this.validate(() => validateLeadActivityUpdate(input));
    this.requireUpdateAssignment(current, validated, actor);
    try {
      return await this.repository.update(validatedId, validated);
    } catch (error) {
      if (error instanceof LeadActivityRepositoryNotFoundError) {
        throw new LeadActivityNotFoundError();
      }
      throw error;
    }
  }

  async softDelete(
    id: string,
    actor: LeadActivityActor,
  ): Promise<LeadActivity> {
    this.requireActive(actor);
    const validatedId = this.activityId(id);
    const current = await this.repository.getById(validatedId);
    if (!current) throw new LeadActivityNotFoundError();
    await this.requireLeadModify(current.leadId);
    this.requireActivityOwnership(current, actor);
    try {
      await this.repository.softDelete(validatedId);
      return current;
    } catch (error) {
      if (error instanceof LeadActivityRepositoryNotFoundError) {
        throw new LeadActivityNotFoundError();
      }
      throw error;
    }
  }

  async restore(
    id: string,
    actor: LeadActivityActor,
  ): Promise<LeadActivity> {
    this.requireActive(actor);
    if (!isManagement(actor)) {
      throw new LeadActivityPermissionError(
        "Only management can restore Lead activities",
      );
    }
    const validatedId = this.activityId(id);
    const activity = await this.repository.getById(validatedId, true);
    if (!activity) throw new LeadActivityNotFoundError();
    await this.requireLeadModify(activity.leadId);
    try {
      await this.repository.restore(validatedId);
      return activity;
    } catch (error) {
      if (error instanceof LeadActivityRepositoryNotFoundError) {
        throw new LeadActivityNotFoundError();
      }
      throw error;
    }
  }

  async listArchived(
    options: LeadActivityListOptions,
    actor: LeadActivityActor,
  ): Promise<PaginatedLeadActivities> {
    this.requireActive(actor);
    if (!isManagement(actor)) {
      throw new LeadActivityPermissionError(
        "Only management can access archived Lead activities",
      );
    }
    return this.repository.listArchived(
      this.validate(() => validateLeadActivityListOptions(options)),
    );
  }

  async listArchivedByLead(
    leadId: string,
    options: LeadActivityListOptions,
    actor: LeadActivityActor,
  ): Promise<PaginatedLeadActivities> {
    this.requireActive(actor);
    if (!isManagement(actor)) {
      throw new LeadActivityPermissionError(
        "Only management can access archived Lead activities",
      );
    }
    const validatedLeadId = this.activityId(leadId);
    await this.requireLeadAccess(validatedLeadId);
    return this.repository.listArchivedByLead(
      validatedLeadId,
      this.validate(() => validateLeadActivityListOptions(options)),
    );
  }

  private requireActive(actor: LeadActivityActor): void {
    try {
      validateLeadActivityId(actor.userId);
    } catch {
      throw new LeadActivityPermissionError(
        "A valid authenticated actor is required",
      );
    }
    if (!actor.isActive) {
      throw new LeadActivityPermissionError(
        "Inactive users cannot access Lead activities",
      );
    }
  }

  private requireCreateAssignment(
    assignedTo: string | null | undefined,
    actor: LeadActivityActor,
  ): void {
    if (!isManagement(actor) && assignedTo && assignedTo !== actor.userId) {
      throw new LeadActivityPermissionError(
        "Representatives cannot assign Lead activities to another user",
      );
    }
  }

  private requireActivityOwnership(
    activity: LeadActivity,
    actor: LeadActivityActor,
  ): void {
    if (isManagement(actor)) return;
    if (
      activity.createdBy !== actor.userId &&
      activity.assignedTo !== actor.userId
    ) {
      throw new LeadActivityPermissionError(
        "Representatives can only modify their own or assigned Lead activities",
      );
    }
  }

  private requireUpdateAssignment(
    current: LeadActivity,
    input: LeadActivityUpdateInput,
    actor: LeadActivityActor,
  ): void {
    if (
      isManagement(actor) ||
      !("assignedTo" in input) ||
      input.assignedTo === current.assignedTo
    ) {
      return;
    }
    const selfAssignment =
      current.assignedTo === null &&
      current.createdBy === actor.userId &&
      input.assignedTo === actor.userId;
    if (!selfAssignment) {
      throw new LeadActivityPermissionError(
        "Representatives cannot change this activity assignment",
      );
    }
  }

  private async requireLeadAccess(leadId: string): Promise<void> {
    if (!(await this.leadRepository.canAccess(leadId))) {
      throw new LeadActivityPermissionError();
    }
  }

  private async requireLeadModify(leadId: string): Promise<void> {
    if (!(await this.leadRepository.canModify(leadId))) {
      throw new LeadActivityPermissionError(
        "The parent Lead is not available for modification",
      );
    }
  }

  private activityId(value: string): string {
    return this.validate(() => validateLeadActivityId(value));
  }

  private validate<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new LeadActivityValidationError(error.issues, error);
      }
      throw error;
    }
  }
}
