import { z } from "zod";
import {
  leadPriorityValues,
  leadQualificationValues,
  leadSortFields,
  leadStageValues,
  leadStatusValues,
  type LeadListOptions,
  type LeadPriority,
  type LeadQualificationStatus,
  type LeadSortField,
  type LeadStage,
  type LeadStatus,
  type SortDirection,
} from "./lead.types";

export type LeadSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type LeadQueryState = {
  q?: string;
  companyId?: string;
  assignedTo?: string;
  stage?: LeadStage;
  leadStatus?: LeadStatus;
  qualificationStatus?: LeadQualificationStatus;
  priority?: LeadPriority;
  sortBy: LeadSortField;
  sortDirection: SortDirection;
  page: number;
};

const firstValue = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value;

const optionalText = z
  .preprocess(firstValue, z.string().trim().min(1).max(200).optional())
  .catch(undefined);

const optionalUuid = z
  .preprocess(firstValue, z.uuid().optional())
  .catch(undefined);

const querySchema = z.object({
  q: optionalText,
  companyId: optionalUuid,
  assignedTo: optionalUuid,
  stage: z
    .preprocess(firstValue, z.enum(leadStageValues).optional())
    .catch(undefined),
  leadStatus: z
    .preprocess(firstValue, z.enum(leadStatusValues).optional())
    .catch(undefined),
  qualificationStatus: z
    .preprocess(firstValue, z.enum(leadQualificationValues).optional())
    .catch(undefined),
  priority: z
    .preprocess(firstValue, z.enum(leadPriorityValues).optional())
    .catch(undefined),
  sortBy: z
    .preprocess(firstValue, z.enum(leadSortFields))
    .catch("updatedAt"),
  sortDirection: z
    .preprocess(firstValue, z.enum(["asc", "desc"]))
    .catch("desc"),
  page: z
    .preprocess(firstValue, z.coerce.number().int().positive().max(1_000_000))
    .catch(1),
});

function fromUrlSearchParams(searchParams: URLSearchParams): LeadSearchParams {
  const input: LeadSearchParams = {};
  for (const key of new Set(searchParams.keys())) {
    input[key] = searchParams.getAll(key);
  }
  return input;
}

export function parseLeadQueryState(
  searchParams: LeadSearchParams | URLSearchParams,
): LeadQueryState {
  return querySchema.parse(
    searchParams instanceof URLSearchParams
      ? fromUrlSearchParams(searchParams)
      : searchParams,
  );
}

export function toLeadListOptions(
  query: LeadQueryState,
  pageSize: number,
): LeadListOptions {
  return {
    query: query.q,
    companyId: query.companyId,
    assignedTo: query.assignedTo,
    stage: query.stage,
    leadStatus: query.leadStatus,
    qualificationStatus: query.qualificationStatus,
    priority: query.priority,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    page: query.page,
    pageSize,
  };
}

export function toLeadSearchParams(query: LeadQueryState): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.companyId) params.set("companyId", query.companyId);
  if (query.assignedTo) params.set("assignedTo", query.assignedTo);
  if (query.stage) params.set("stage", query.stage);
  if (query.leadStatus) params.set("leadStatus", query.leadStatus);
  if (query.qualificationStatus) {
    params.set("qualificationStatus", query.qualificationStatus);
  }
  if (query.priority) params.set("priority", query.priority);
  if (query.sortBy !== "updatedAt") params.set("sortBy", query.sortBy);
  if (query.sortDirection !== "desc") {
    params.set("sortDirection", query.sortDirection);
  }
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function buildLeadsHref(
  query: LeadQueryState,
  updates: Partial<LeadQueryState> = {},
  archived = false,
): string {
  const params = toLeadSearchParams({ ...query, ...updates });
  const base = archived ? "/leads/archived" : "/leads";
  const search = params.toString();
  return search ? `${base}?${search}` : base;
}

export function hasLeadFilters(query: LeadQueryState): boolean {
  return Boolean(
    query.q ||
      query.companyId ||
      query.assignedTo ||
      query.stage ||
      query.leadStatus ||
      query.qualificationStatus ||
      query.priority,
  );
}

export function clearLeadFiltersHref(
  query: LeadQueryState,
  archived = false,
): string {
  return buildLeadsHref(
    query,
    {
      q: undefined,
      companyId: undefined,
      assignedTo: undefined,
      stage: undefined,
      leadStatus: undefined,
      qualificationStatus: undefined,
      priority: undefined,
      page: 1,
    },
    archived,
  );
}

export function isCanonicalLeadQuery(
  searchParams: LeadSearchParams,
  query: LeadQueryState,
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
    JSON.stringify(entries(toLeadSearchParams(query)))
  );
}

export function getLeadResultRange(
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
