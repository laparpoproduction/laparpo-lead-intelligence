import { ZodError } from "zod";
import {
  ContactRepositoryNotFoundError,
  type ContactRepository,
} from "./contact.repository";
import {
  isLikelyDuplicateContact,
  normalizeContactName,
  type ContactDuplicateInput,
} from "./contact-normalization";
import type {
  Contact,
  ContactActor,
  ContactConfirmationContext,
  ContactListOptions,
  ConfirmedContactMutationResult,
  CreateContactInput,
  PaginatedContacts,
  UpdateContactInput,
  ValidatedCreateContactInput,
} from "./contact.types";
import {
  validateContactCreate,
  validateContactId,
  validateContactListOptions,
  validateContactUpdate,
} from "./contact.validation";

export class ContactPermissionError extends Error {
  constructor(message = "Not permitted to manage this contact") {
    super(message);
    this.name = "ContactPermissionError";
  }
}

export class ContactNotFoundError extends Error {
  constructor() {
    super("Contact not found");
    this.name = "ContactNotFoundError";
  }
}

export class ContactDuplicateError extends Error {
  constructor(readonly candidateIds: string[]) {
    super("A likely duplicate contact already exists");
    this.name = "ContactDuplicateError";
  }
}

export class ContactValidationError extends Error {
  constructor(readonly issues: ZodError["issues"], cause?: unknown) {
    super("Contact data is invalid", { cause });
    this.name = "ContactValidationError";
  }
}

const managementRoles = new Set(["ceo_admin", "sales_manager"]);
const identityFields = new Set<keyof UpdateContactInput>([
  "companyId",
  "fullName",
  "firstName",
  "lastName",
  "workEmail",
  "personalEmail",
  "publicPhone",
  "mobilePhone",
  "whatsappPhone",
  "linkedinUrl",
]);

function isManagement(actor: ContactActor): boolean {
  return managementRoles.has(actor.role);
}

function duplicateInput(
  contact: Contact | ValidatedCreateContactInput,
): ContactDuplicateInput {
  const suppliedName = contact.fullName;
  const derivedName = normalizeContactName(
    [contact.firstName, contact.lastName].filter(Boolean).join(" "),
  );
  return {
    companyId: contact.companyId,
    fullName: suppliedName || derivedName || null,
    workEmail: contact.workEmail,
    personalEmail: contact.personalEmail,
    publicPhone: contact.publicPhone,
    mobilePhone: contact.mobilePhone,
    whatsappPhone: contact.whatsappPhone,
    linkedinUrl: contact.linkedinUrl,
  };
}

export class ContactService {
  constructor(private readonly repository: ContactRepository) {}

  async create(input: CreateContactInput, actor: ContactActor): Promise<Contact> {
    this.requireActive(actor);
    const validated = this.validate(() => validateContactCreate(input));
    this.requireCreateAssignment(validated, actor);
    await this.verifyNoDuplicate(validated);
    return this.repository.create(validated, actor.userId);
  }

  async createConfirmedDuplicate(
    input: CreateContactInput,
    actor: ContactActor,
    confirmation: ContactConfirmationContext,
  ): Promise<ConfirmedContactMutationResult> {
    this.requireActive(actor);
    if (confirmation.operation !== "create" || confirmation.contactId !== undefined) {
      throw new ContactPermissionError("Invalid create confirmation binding");
    }
    const validated = this.validate(() => validateContactCreate(input));
    this.requireCreateAssignment(validated, actor);
    return this.repository.createConfirmed(validated, actor.userId, confirmation);
  }

  async getById(id: string, actor: ContactActor): Promise<Contact> {
    this.requireActive(actor);
    const contact = await this.repository.getById(this.contactId(id));
    if (!contact) throw new ContactNotFoundError();
    return contact;
  }

  async list(
    options: ContactListOptions,
    actor: ContactActor,
  ): Promise<PaginatedContacts> {
    this.requireActive(actor);
    return this.repository.list(this.validate(() => validateContactListOptions(options)));
  }

  async search(
    options: ContactListOptions,
    actor: ContactActor,
  ): Promise<PaginatedContacts> {
    this.requireActive(actor);
    return this.repository.search(this.validate(() => validateContactListOptions(options)));
  }

  async update(
    id: string,
    input: UpdateContactInput,
    actor: ContactActor,
  ): Promise<Contact> {
    this.requireActive(actor);
    const validatedId = this.contactId(id);
    const current = await this.repository.getById(validatedId);
    if (!current) throw new ContactNotFoundError();
    this.requireUpdateAccess(current, actor);

    const validated = this.validate(() => validateContactUpdate(input, current));
    this.requireRepresentativeUpdate(current, validated, actor);

    if (Object.keys(validated).some((field) => identityFields.has(field as keyof UpdateContactInput))) {
      const merged = { ...current, ...validated };
      await this.verifyNoDuplicate(merged, current.id);
    }

    try {
      return await this.repository.update(validatedId, validated);
    } catch (error) {
      if (error instanceof ContactRepositoryNotFoundError) throw new ContactNotFoundError();
      throw error;
    }
  }

  async updateConfirmedDuplicate(
    id: string,
    input: UpdateContactInput,
    actor: ContactActor,
    confirmation: ContactConfirmationContext,
  ): Promise<ConfirmedContactMutationResult> {
    this.requireActive(actor);
    const validatedId = this.contactId(id);
    if (
      confirmation.operation !== "update" ||
      confirmation.contactId !== validatedId
    ) {
      throw new ContactPermissionError("Invalid update confirmation binding");
    }

    const current = await this.repository.getById(validatedId);
    if (!current) throw new ContactNotFoundError();
    this.requireUpdateAccess(current, actor);
    const validated = this.validate(() => validateContactUpdate(input, current));
    this.requireRepresentativeUpdate(current, validated, actor);
    return this.repository.updateConfirmed(validatedId, validated, confirmation);
  }

  async softDelete(id: string, actor: ContactActor): Promise<void> {
    this.requireActive(actor);
    if (!isManagement(actor)) {
      throw new ContactPermissionError("Only management can archive contacts");
    }
    const validatedId = this.contactId(id);
    const contact = await this.repository.getById(validatedId);
    if (!contact) throw new ContactNotFoundError();
    try {
      await this.repository.softDelete(validatedId);
    } catch (error) {
      if (error instanceof ContactRepositoryNotFoundError) throw new ContactNotFoundError();
      throw error;
    }
  }

  async listArchived(
    options: ContactListOptions,
    actor: ContactActor,
  ): Promise<PaginatedContacts> {
    this.requireActive(actor);
    if (!isManagement(actor)) {
      throw new ContactPermissionError("Only management can access archived contacts");
    }
    return this.repository.listArchived(
      this.validate(() => validateContactListOptions(options)),
    );
  }

  async findByCompany(
    companyId: string,
    options: ContactListOptions,
    actor: ContactActor,
  ): Promise<PaginatedContacts> {
    this.requireActive(actor);
    return this.repository.findByCompany(
      this.contactId(companyId),
      this.validate(() => validateContactListOptions(options)),
    );
  }

  async findByAssignee(
    userId: string,
    options: ContactListOptions,
    actor: ContactActor,
  ): Promise<PaginatedContacts> {
    this.requireActive(actor);
    return this.repository.findByAssignee(
      this.contactId(userId),
      this.validate(() => validateContactListOptions(options)),
    );
  }

  async findByCreator(
    userId: string,
    options: ContactListOptions,
    actor: ContactActor,
  ): Promise<PaginatedContacts> {
    this.requireActive(actor);
    return this.repository.findByCreator(
      this.contactId(userId),
      this.validate(() => validateContactListOptions(options)),
    );
  }

  private requireActive(actor: ContactActor): void {
    try {
      validateContactId(actor.userId);
    } catch {
      throw new ContactPermissionError("A valid authenticated actor is required");
    }
    if (!actor.isActive) {
      throw new ContactPermissionError("Inactive users cannot access contacts");
    }
  }

  private requireCreateAssignment(
    input: ValidatedCreateContactInput,
    actor: ContactActor,
  ): void {
    if (!isManagement(actor) && input.assignedTo && input.assignedTo !== actor.userId) {
      throw new ContactPermissionError("Representatives cannot assign contacts to another user");
    }
  }

  private requireUpdateAccess(contact: Contact, actor: ContactActor): void {
    if (isManagement(actor)) return;
    if (contact.createdBy !== actor.userId && contact.assignedTo !== actor.userId) {
      throw new ContactPermissionError(
        "Company-derived contact access is read-only",
      );
    }
  }

  private requireRepresentativeUpdate(
    current: Contact,
    update: UpdateContactInput,
    actor: ContactActor,
  ): void {
    if (isManagement(actor)) return;

    if ("companyId" in update && update.companyId !== current.companyId) {
      throw new ContactPermissionError("Representatives cannot change a contact company");
    }
    if (!("assignedTo" in update) || update.assignedTo === current.assignedTo) return;

    const creatorSelfAssignment =
      current.assignedTo === null &&
      current.createdBy === actor.userId &&
      update.assignedTo === actor.userId;
    if (!creatorSelfAssignment) {
      throw new ContactPermissionError("Representatives cannot change this assignment");
    }
  }

  private async verifyNoDuplicate(
    input: Contact | ValidatedCreateContactInput,
    excludeId?: string,
  ): Promise<void> {
    const target = duplicateInput(input);
    const candidates = await this.repository.findDuplicateCandidates(target);
    const candidateIds = candidates
      .filter((candidate) => candidate.id !== excludeId)
      .filter((candidate) => isLikelyDuplicateContact(target, candidate))
      .map((candidate) => candidate.id);

    if (candidateIds.length > 0) throw new ContactDuplicateError(candidateIds);
  }

  private contactId(value: string): string {
    return this.validate(() => validateContactId(value));
  }

  private validate<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof ZodError) throw new ContactValidationError(error.issues, error);
      throw error;
    }
  }
}
