import { z } from "zod";
import {
  companySortFields,
  companyTypeValues,
  type CompanyListOptions,
  type CompanySortField,
  type CompanyType,
  type SortDirection,
} from "./company.types";

export type CompanySearchParams = Record<
  string,
  string | string[] | undefined
>;

export type CompanyQueryState = {
  q?: string;
  companyType?: CompanyType;
  industry?: string;
  city?: string;
  state?: string;
  sortBy: CompanySortField;
  sortDirection: SortDirection;
  page: number;
};

const firstValue = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value;

const optionalText = z
  .preprocess(firstValue, z.string().trim().min(1).max(200).optional())
  .catch(undefined);

const querySchema = z.object({
  q: optionalText,
  companyType: z
    .preprocess(firstValue, z.enum(companyTypeValues).optional())
    .catch(undefined),
  industry: optionalText,
  city: optionalText,
  state: optionalText,
  sortBy: z
    .preprocess(firstValue, z.enum(companySortFields))
    .catch("createdAt"),
  sortDirection: z
    .preprocess(firstValue, z.enum(["asc", "desc"]))
    .catch("desc"),
  page: z
    .preprocess(firstValue, z.coerce.number().int().positive().max(1_000_000))
    .catch(1),
});

export function parseCompanyQueryState(
  searchParams: CompanySearchParams | URLSearchParams,
): CompanyQueryState {
  const input =
    searchParams instanceof URLSearchParams
      ? Object.fromEntries(searchParams.entries())
      : searchParams;
  return querySchema.parse(input);
}

export function toCompanyListOptions(
  query: CompanyQueryState,
  pageSize: number,
): CompanyListOptions {
  return {
    query: query.q,
    companyType: query.companyType,
    industry: query.industry,
    city: query.city,
    state: query.state,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    page: query.page,
    pageSize,
  };
}

export function toCompanySearchParams(
  query: CompanyQueryState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.companyType) params.set("companyType", query.companyType);
  if (query.industry) params.set("industry", query.industry);
  if (query.city) params.set("city", query.city);
  if (query.state) params.set("state", query.state);
  if (query.sortBy !== "createdAt") params.set("sortBy", query.sortBy);
  if (query.sortDirection !== "desc") {
    params.set("sortDirection", query.sortDirection);
  }
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function buildCompaniesHref(
  query: CompanyQueryState,
  updates: Partial<CompanyQueryState> = {},
): string {
  const params = toCompanySearchParams({ ...query, ...updates });
  const search = params.toString();
  return search ? `/companies?${search}` : "/companies";
}

export function hasCompanyFilters(query: CompanyQueryState): boolean {
  return Boolean(
    query.q ||
      query.companyType ||
      query.industry ||
      query.city ||
      query.state,
  );
}

export function clearCompanyFiltersHref(query: CompanyQueryState): string {
  return buildCompaniesHref(query, {
    q: undefined,
    companyType: undefined,
    industry: undefined,
    city: undefined,
    state: undefined,
    page: 1,
  });
}

export function isCanonicalCompanyQuery(
  searchParams: CompanySearchParams,
  query: CompanyQueryState,
): boolean {
  const received = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => received.append(key, item));
    } else if (value !== undefined) {
      received.append(key, value);
    }
  });

  const entries = (params: URLSearchParams) =>
    Array.from(params.entries()).sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey === rightKey
          ? leftValue.localeCompare(rightValue)
          : leftKey.localeCompare(rightKey),
    );

  return (
    JSON.stringify(entries(received)) ===
    JSON.stringify(entries(toCompanySearchParams(query)))
  );
}

export function getCompanyResultRange(
  page: number,
  pageSize: number,
  total: number,
): { first: number; last: number } {
  if (total === 0) return { first: 0, last: 0 };
  return {
    first: (page - 1) * pageSize + 1,
    last: Math.min(page * pageSize, total),
  };
}
