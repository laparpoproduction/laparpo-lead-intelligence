import type { SupabaseClient } from "@supabase/supabase-js";
import { mapCompanyCreate, mapCompanyRow, mapCompanyUpdate } from "./company.mapper";
import { normalizeWebsiteDomain } from "./duplicate";
import type {
  Company,
  CompanyListOptions,
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

export interface CompanyRepository {
  create(input: ValidatedCreateCompanyInput, createdBy: string): Promise<Company>;
  getById(id: string, includeDeleted?: boolean): Promise<Company | null>;
  getByFingerprint(fingerprint: string, includeDeleted?: boolean): Promise<Company | null>;
  getByDomain(domain: string, includeDeleted?: boolean): Promise<Company | null>;
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

  async getByFingerprint(fingerprint: string, includeDeleted = false): Promise<Company | null> {
    return this.getSingle(
      "fingerprint",
      validateCompanyFingerprint(fingerprint),
      includeDeleted,
      "get by fingerprint",
    );
  }

  async getByDomain(domain: string, includeDeleted = false): Promise<Company | null> {
    const normalized = normalizeWebsiteDomain(domain);
    if (!normalized) return null;
    return this.getSingle("website_domain", normalized, includeDeleted, "get by domain");
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
      .single();

    if (error || !data) throw new CompanyRepositoryError("update", causeFrom(error));
    return mapCompanyRow(data as unknown as Parameters<typeof mapCompanyRow>[0]);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.client
      .from("companies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", validateCompanyId(id))
      .is("deleted_at", null);

    if (error) throw new CompanyRepositoryError("soft delete", causeFrom(error));
  }

  async canAccess(id: string): Promise<boolean> {
    const { data, error } = await this.client.rpc("can_access_company", {
      target_company_id: validateCompanyId(id),
    });
    if (error) throw new CompanyRepositoryError("permission check", causeFrom(error));
    return data === true;
  }

  private async getSingle(
    column: "id" | "fingerprint" | "website_domain",
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
}
