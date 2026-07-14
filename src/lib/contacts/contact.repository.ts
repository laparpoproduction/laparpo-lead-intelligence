import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { mapContactCreate, mapContactRow, mapContactUpdate } from "./contact.mapper";
import type { ContactDuplicateInput } from "./contact-normalization";
import {
  normalizeContactEmail,
  normalizeContactNameKey,
  normalizeContactPhone,
  normalizeContactProfileUrl,
} from "./contact-normalization";
import type {
  Contact,
  ContactConfirmationContext,
  ConfirmedContactMutationResult,
  ContactDuplicateCandidate,
  ContactListOptions,
  ContactSortField,
  PaginatedContacts,
  UpdateContactInput,
  ValidatedCreateContactInput,
} from "./contact.types";
import {
  validateContactId,
  validateContactListOptions,
} from "./contact.validation";

export class ContactRepositoryError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Contact repository ${operation} failed`, { cause });
    this.name = "ContactRepositoryError";
  }
}

export class ContactRepositoryNotFoundError extends ContactRepositoryError {
  constructor(operation: string) {
    super(operation);
    this.message = `Contact repository ${operation} found no active contact`;
    this.name = "ContactRepositoryNotFoundError";
  }
}

export interface ContactRepository {
  create(input: ValidatedCreateContactInput, createdBy: string): Promise<Contact>;
  createConfirmed(
    input: ValidatedCreateContactInput,
    createdBy: string,
    confirmation: ContactConfirmationContext,
  ): Promise<ConfirmedContactMutationResult>;
  getById(id: string): Promise<Contact | null>;
  list(options?: ContactListOptions): Promise<PaginatedContacts>;
  search(options: ContactListOptions): Promise<PaginatedContacts>;
  update(id: string, input: UpdateContactInput): Promise<Contact>;
  updateConfirmed(
    id: string,
    input: UpdateContactInput,
    confirmation: ContactConfirmationContext,
  ): Promise<ConfirmedContactMutationResult>;
  softDelete(id: string): Promise<void>;
  findDuplicateCandidates(input: ContactDuplicateInput): Promise<ContactDuplicateCandidate[]>;
  listArchived(options?: ContactListOptions): Promise<PaginatedContacts>;
  findByCompany(companyId: string, options?: ContactListOptions): Promise<PaginatedContacts>;
  findByAssignee(userId: string, options?: ContactListOptions): Promise<PaginatedContacts>;
  findByCreator(userId: string, options?: ContactListOptions): Promise<PaginatedContacts>;
}

type DatabaseClient = Pick<SupabaseClient, "from" | "rpc">;

const sortColumns: Record<ContactSortField, string> = {
  fullName: "full_name",
  jobTitle: "job_title",
  department: "department",
  contactStatus: "contact_status",
  createdAt: "created_at",
  updatedAt: "updated_at",
  lastVerifiedAt: "last_verified_at",
};

const duplicateCandidatePageSize = 100;

function quotePostgrestValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

function causeFrom(error: unknown): unknown {
  if (error && typeof error === "object" && "message" in error) return error;
  return new Error(String(error));
}

function toDuplicateCandidate(contact: Contact): ContactDuplicateCandidate {
  return {
    id: contact.id,
    companyId: contact.companyId,
    fullName: contact.fullName,
    workEmail: contact.workEmail,
    personalEmail: contact.personalEmail,
    publicPhone: contact.publicPhone,
    mobilePhone: contact.mobilePhone,
    whatsappPhone: contact.whatsappPhone,
    linkedinUrl: contact.linkedinUrl,
  };
}

const confirmedMutationResultSchema = z.object({
  contact_id: z.uuid(),
  already_processed: z.boolean(),
});

function mapConfirmedMutationResult(value: unknown): ConfirmedContactMutationResult {
  const parsed = confirmedMutationResultSchema.parse(value);
  return {
    status: parsed.already_processed ? "already_processed" : "applied",
    contactId: parsed.contact_id,
  };
}

export class SupabaseContactRepository implements ContactRepository {
  constructor(private readonly client: DatabaseClient) {}

  async create(input: ValidatedCreateContactInput, createdBy: string): Promise<Contact> {
    const { data, error } = await this.client
      .from("contacts")
      .insert(mapContactCreate(input, validateContactId(createdBy)))
      .select("*")
      .single();

    if (error || !data) throw new ContactRepositoryError("create", causeFrom(error));
    return mapContactRow(data);
  }

  async createConfirmed(
    input: ValidatedCreateContactInput,
    createdBy: string,
    confirmation: ContactConfirmationContext,
  ): Promise<ConfirmedContactMutationResult> {
    const { data, error } = await this.client.rpc(
      "create_confirmed_duplicate_contact",
      {
        target_confirmation_id: validateContactId(confirmation.confirmationId),
        target_submission_hash: confirmation.submissionHash,
        contact_data: mapContactCreate(input, validateContactId(createdBy)),
      },
    );
    if (error || !data) {
      throw new ContactRepositoryError("confirmed create", causeFrom(error));
    }
    try {
      return mapConfirmedMutationResult(data);
    } catch (mappingError) {
      throw new ContactRepositoryError(
        "confirmed create response",
        causeFrom(mappingError),
      );
    }
  }

  async getById(id: string): Promise<Contact | null> {
    const { data, error } = await this.client
      .from("contacts")
      .select("*")
      .eq("id", validateContactId(id))
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new ContactRepositoryError("get by id", causeFrom(error));
    return data ? mapContactRow(data) : null;
  }

  async list(options: ContactListOptions = {}): Promise<PaginatedContacts> {
    return this.listFrom(this.client.from("contacts"), options, false);
  }

  search(options: ContactListOptions): Promise<PaginatedContacts> {
    return this.list(options);
  }

  async update(id: string, input: UpdateContactInput): Promise<Contact> {
    const { data, error } = await this.client
      .from("contacts")
      .update(mapContactUpdate(input))
      .eq("id", validateContactId(id))
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) throw new ContactRepositoryError("update", causeFrom(error));
    if (!data) throw new ContactRepositoryNotFoundError("update");
    return mapContactRow(data);
  }

  async updateConfirmed(
    id: string,
    input: UpdateContactInput,
    confirmation: ContactConfirmationContext,
  ): Promise<ConfirmedContactMutationResult> {
    const validatedId = validateContactId(id);
    const { data, error } = await this.client.rpc(
      "update_confirmed_duplicate_contact",
      {
        target_confirmation_id: validateContactId(confirmation.confirmationId),
        target_submission_hash: confirmation.submissionHash,
        target_contact_id: validatedId,
        contact_updates: mapContactUpdate(input),
      },
    );
    if (error || !data) {
      throw new ContactRepositoryError("confirmed update", causeFrom(error));
    }
    try {
      return mapConfirmedMutationResult(data);
    } catch (mappingError) {
      throw new ContactRepositoryError(
        "confirmed update response",
        causeFrom(mappingError),
      );
    }
  }

  async softDelete(id: string): Promise<void> {
    const { data, error } = await this.client
      .from("contacts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", validateContactId(id))
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) throw new ContactRepositoryError("soft delete", causeFrom(error));
    if (!data) throw new ContactRepositoryNotFoundError("soft delete");
  }

  async findDuplicateCandidates(
    input: ContactDuplicateInput,
  ): Promise<ContactDuplicateCandidate[]> {
    const fullName = normalizeContactNameKey(input.fullName) || null;
    const workEmail = normalizeContactEmail(input.workEmail) || null;
    const personalEmail = normalizeContactEmail(input.personalEmail) || null;
    const publicPhone = normalizeContactPhone(input.publicPhone) || null;
    const mobilePhone = normalizeContactPhone(input.mobilePhone) || null;
    const whatsappPhone = normalizeContactPhone(input.whatsappPhone) || null;
    const linkedinUrl = normalizeContactProfileUrl(input.linkedinUrl) || null;

    if (
      !workEmail &&
      !personalEmail &&
      !linkedinUrl &&
      !whatsappPhone &&
      !(fullName && (input.companyId || publicPhone || mobilePhone))
    ) {
      return [];
    }

    const candidates: ContactDuplicateCandidate[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await this.client
        .rpc("find_contact_duplicate_candidates", {
          candidate_company_id: input.companyId ?? null,
          candidate_full_name: input.fullName ?? null,
          candidate_work_email: workEmail,
          candidate_personal_email: personalEmail,
          candidate_public_phone: publicPhone,
          candidate_mobile_phone: mobilePhone,
          candidate_whatsapp_phone: whatsappPhone,
          candidate_linkedin_url: linkedinUrl,
        })
        .order("id", { ascending: true })
        .range(offset, offset + duplicateCandidatePageSize - 1);

      if (error) {
        throw new ContactRepositoryError("find duplicate candidates", causeFrom(error));
      }

      const page = (data ?? []).map((row: unknown) => toDuplicateCandidate(mapContactRow(row)));
      candidates.push(...page);
      if (page.length < duplicateCandidatePageSize) break;
      offset += duplicateCandidatePageSize;
    }

    return candidates;
  }

  async listArchived(options: ContactListOptions = {}): Promise<PaginatedContacts> {
    return this.listFrom(
      this.client.rpc("list_archived_contacts"),
      options,
      true,
    );
  }

  findByCompany(
    companyId: string,
    options: ContactListOptions = {},
  ): Promise<PaginatedContacts> {
    return this.list({ ...options, companyId: validateContactId(companyId) });
  }

  findByAssignee(
    userId: string,
    options: ContactListOptions = {},
  ): Promise<PaginatedContacts> {
    return this.list({ ...options, assignedTo: validateContactId(userId) });
  }

  findByCreator(
    userId: string,
    options: ContactListOptions = {},
  ): Promise<PaginatedContacts> {
    return this.list({ ...options, createdBy: validateContactId(userId) });
  }

  private async listFrom(
    source: ReturnType<DatabaseClient["from"]> | ReturnType<DatabaseClient["rpc"]>,
    options: ContactListOptions,
    archived: boolean,
  ): Promise<PaginatedContacts> {
    const parsed = validateContactListOptions(options);
    const start = (parsed.page - 1) * parsed.pageSize;
    const end = start + parsed.pageSize - 1;

    let query = source.select("*", { count: "exact" });
    if (!archived) query = query.is("deleted_at", null);
    if (parsed.companyId) query = query.eq("company_id", parsed.companyId);
    if (parsed.assignedTo) query = query.eq("assigned_to", parsed.assignedTo);
    if (parsed.createdBy) query = query.eq("created_by", parsed.createdBy);
    if (parsed.contactStatus) query = query.eq("contact_status", parsed.contactStatus);
    if (parsed.isPrimaryContact !== undefined) {
      query = query.eq("is_primary_contact", parsed.isPrimaryContact);
    }
    if (parsed.query) {
      const value = quotePostgrestValue(parsed.query);
      query = query.or(
        [
          "full_name",
          "work_email",
          "personal_email",
          "public_phone",
          "mobile_phone",
          "whatsapp_phone",
          "linkedin_url",
        ]
          .map((column) => `${column}.ilike.${value}`)
          .join(","),
      );
    }

    const { data, error, count } = await query
      .order(sortColumns[parsed.sortBy], { ascending: parsed.sortDirection === "asc" })
      .order("id", { ascending: true })
      .range(start, end);

    if (error) {
      throw new ContactRepositoryError(
        archived ? "list archived" : "list",
        causeFrom(error),
      );
    }

    const total = count ?? 0;
    return {
      items: (data ?? []).map(mapContactRow),
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / parsed.pageSize),
    };
  }
}
