import type { SupabaseClient } from "@supabase/supabase-js";
import { mapCompanyCreate, mapCompanyRow, mapCompanyUpdate } from "./company.mapper";
import { normalizeWebsiteDomain } from "./duplicate";
import type {
  Company,
  CompanyListOptions,
  CompanyLookupOptions,
  CompanySortField,
  CompanyUpdate,
  PaginatedCompanies,
  UpdateCompanyInput,
  ValidatedCreateCompanyInput,
} from "./company.types";
import {
  validateCompanyFingerprint,
  validateCompanyId,
  validateCompanyListOptions,
} from "./company.validation";

export class CompanyRepositoryError extends Error {
  constructor(operation: string, cause?: unknown) {
    super(`Company repository ${operation} failed`, { cause });
    this.name = "CompanyRepositoryError";
  }
}

export class CompanyRepositoryNotFoundError extends CompanyRepositoryError {
  constructor(operation: string) {
    super(operation);
    this.message = `Company repository ${operation} found no active company`;
    this.name = "CompanyRepositoryNotFoundError";
  }
}

export interface CompanyRepository {
  create(input: ValidatedCreateCompanyInput, createdBy: string): Promise<Company>;
  getById(id: string, includeDeleted?: boolean): Promise<Company | null>;
  findByFingerprint(fingerprint: string, options?: CompanyLookupOptions): Promise<Company[]>;
  findByDomain(domain: string, options?: CompanyLookupOptions): Promise<Company[]>;
  list(options?: CompanyListOptions): Promise<PaginatedCompanies>;
  search(options: CompanyListOptions): Promise<PaginatedCompanies>;
  update(id: string, input: UpdateCompanyInput): Promise<Company>;
  softDelete(id: string): Promise<void>;
  canAccess(id: string): Promise<boolean>;
}

type DatabaseClient = Pick<SupabaseClient, "from" | "rpc">;

const sortColumns: Record<CompanySortField, string> = {
  displayName: "display_name",
  legalName: "legal_name",
  industry: "industry",
  city: "city",
  state: "state",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

function quotePostgrestValue(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

function causeFrom(error: unknown): unknown {
  if (error && typeof error === "object" && "message" in error) return error;
  return new Error(String(error));
}

export class SupabaseCompanyRepository implements CompanyRepository {
  constructor(private readonly client: DatabaseClient) {}

  async create(input: ValidatedCreateCompanyInput, createdBy: string): Promise<Company> {
    const { data, error } = await this.client
      .from("companies")
      .insert(mapCompanyCreate(input, validateCompanyId(createdBy)))
      .select("*")
      .single();

    if (error || !data) throw new CompanyRepositoryError("create", causeFrom(error));
    return mapCompanyRow(data as unknown as Parameters<typeof mapCompanyRow>[0]);
  }

  async getById(id: string, includeDeleted = false): Promise<Company | null> {
    return this.getSingle("id", validateCompanyId(id), includeDeleted, "get by id");
  }

  async findByFingerprint(
    fingerprint: string,
    options: CompanyLookupOptions = {},
  ): Promise<Company[]> {
    return this.findMany(
      "fingerprint",
      validateCompanyFingerprint(fingerprint),
      options.includeDeleted ?? false,
      "find by fingerprint",
    );
  }

  async findByDomain(
    domain: string,
    options: CompanyLookupOptions = {},
  ): Promise<Company[]> {
    const normalized = normalizeWebsiteDomain(domain);
    if (!normalized) return [];
    return this.findMany(
      "website_domain",
      normalized,
      options.includeDeleted ?? false,
      "find by domain",
    );
  }

  async list(options: CompanyListOptions = {}): Promise<PaginatedCompanies> {
    const parsed = validateCompanyListOptions(options);
    const start = (parsed.page - 1) * parsed.pageSize;
    const end = start + parsed.pageSize - 1;

    let query = this.client.from("companies").select("*", { count: "exact" });

    if (!parsed.includeDeleted) query = query.is("deleted_at", null);
    if (parsed.domain) query = query.eq("website_domain", parsed.domain);
    if (parsed.companyType) query = query.eq("company_type", parsed.companyType);
    if (parsed.createdBy) query = query.eq("created_by", parsed.createdBy);
    if (parsed.city) query = query.ilike("city", parsed.city);
    if (parsed.state) query = query.ilike("state", parsed.state);
    if (parsed.industry) query = query.ilike("industry", parsed.industry);
    if (parsed.query) {
      const value = quotePostgrestValue(parsed.query);
      query = query.or(
        `display_name.ilike.${value},legal_name.ilike.${value},website_domain.ilike.${value}`,
      );
    }

    const { data, error, count } = await query
      .order(sortColumns[parsed.sortBy], { ascending: parsed.sortDirection === "asc" })
      .range(start, end);

    if (error) throw new CompanyRepositoryError("list", causeFrom(error));
    const items = (data ?? []).map((row) =>
      mapCompanyRow(row as unknown as Parameters<typeof mapCompanyRow>[0]),
    );
    const total = count ?? 0;

    return {
      items,
      page: parsed.page,
      pageSize: parsed.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / parsed.pageSize),
    };
  }

  search(options: CompanyListOptions): Promise<PaginatedCompanies> {
    return this.list(options);
  }

  async update(id: string, input: UpdateCompanyInput): Promise<Company> {
    const payload: CompanyUpdate = mapCompanyUpdate(input);
    const { data, error } = await this.client
      .from("companies")
      .update(payload)
      .eq("id", validateCompanyId(id))
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) throw new CompanyRepositoryError("update", causeFrom(error));
    if (!data) throw new CompanyRepositoryNotFoundError("update");
    return mapCompanyRow(data as unknown as Parameters<typeof mapCompanyRow>[0]);
  }

  async softDelete(id: string): Promise<void> {
    const { data, error } = await this.client
      .from("companies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", validateCompanyId(id))
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();

    if (error) throw new CompanyRepositoryError("soft delete", causeFrom(error));
    if (!data) throw new CompanyRepositoryNotFoundError("soft delete");
  }

  async canAccess(id: string): Promise<boolean> {
    const { data, error } = await this.client.rpc("can_access_company", {
      target_company_id: validateCompanyId(id),
    });
    if (error) throw new CompanyRepositoryError("permission check", causeFrom(error));
    return data === true;
  }

  private async getSingle(
    column: "id",
    value: string,
    includeDeleted: boolean,
    operation: string,
  ): Promise<Company | null> {
    let query = this.client.from("companies").select("*").eq(column, value);
    if (!includeDeleted) query = query.is("deleted_at", null);
    const { data, error } = await query.maybeSingle();

    if (error) throw new CompanyRepositoryError(operation, causeFrom(error));
    return data
      ? mapCompanyRow(data as unknown as Parameters<typeof mapCompanyRow>[0])
      : null;
  }

  private async findMany(
    column: "fingerprint" | "website_domain",
    value: string,
    includeDeleted: boolean,
    operation: string,
  ): Promise<Company[]> {
    let query = this.client.from("companies").select("*").eq(column, value);
    if (!includeDeleted) query = query.is("deleted_at", null);
    const { data, error } = await query
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw new CompanyRepositoryError(operation, causeFrom(error));
    return (data ?? []).map((row) =>
      mapCompanyRow(row as unknown as Parameters<typeof mapCompanyRow>[0]),
    );
  }
}
