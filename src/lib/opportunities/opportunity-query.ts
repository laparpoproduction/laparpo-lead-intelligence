import { z } from "zod";
import {
  opportunityKindValues,
  opportunityPipelineStageValues,
  opportunityServiceValues,
  opportunitySortValues,
  type OpportunityKind,
  type OpportunityListOptions,
  type OpportunityPipelineStage,
  type OpportunityService,
  type OpportunitySort,
} from "./opportunity.types";

export type OpportunitySearchParams = Record<
  string,
  string | string[] | undefined
>;

export type OpportunityQueryState = {
  q?: string;
  service?: OpportunityService;
  kind: OpportunityKind;
  stage?: OpportunityPipelineStage;
  sort: OpportunitySort;
  page: number;
};

const firstValue = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value;

const querySchema = z.object({
  q: z
    .preprocess(firstValue, z.string().trim().min(1).max(200).optional())
    .catch(undefined),
  service: z
    .preprocess(firstValue, z.enum(opportunityServiceValues).optional())
    .catch(undefined),
  kind: z
    .preprocess(firstValue, z.enum(opportunityKindValues))
    .catch("all"),
  stage: z
    .preprocess(firstValue, z.enum(opportunityPipelineStageValues).optional())
    .catch(undefined),
  sort: z
    .preprocess(firstValue, z.enum(opportunitySortValues))
    .catch("newest"),
  page: z
    .preprocess(firstValue, z.coerce.number().int().positive().max(1_000_000))
    .catch(1),
});

function fromUrlSearchParams(
  searchParams: URLSearchParams,
): OpportunitySearchParams {
  const input: OpportunitySearchParams = {};
  for (const key of new Set(searchParams.keys())) {
    input[key] = searchParams.getAll(key);
  }
  return input;
}

export function parseOpportunityQueryState(
  searchParams: OpportunitySearchParams | URLSearchParams,
): OpportunityQueryState {
  return querySchema.parse(
    searchParams instanceof URLSearchParams
      ? fromUrlSearchParams(searchParams)
      : searchParams,
  );
}

export function toOpportunityListOptions(
  query: OpportunityQueryState,
  pageSize: number,
): OpportunityListOptions {
  const options: OpportunityListOptions = {
    query: query.q,
    service: query.service,
    kind: query.kind,
    sort: query.sort,
    page: query.page,
    pageSize,
  };
  if (query.stage) options.pipelineStage = query.stage;
  return options;
}

export function toOpportunitySearchParams(
  query: OpportunityQueryState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.service) params.set("service", query.service);
  if (query.kind !== "all") params.set("kind", query.kind);
  if (query.stage) params.set("stage", query.stage);
  if (query.sort !== "newest") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function buildOpportunitiesHref(
  query: OpportunityQueryState,
  updates: Partial<OpportunityQueryState> = {},
): string {
  const search = toOpportunitySearchParams({ ...query, ...updates }).toString();
  return search ? `/opportunities?${search}` : "/opportunities";
}

export function hasOpportunityFilters(query: OpportunityQueryState): boolean {
  return Boolean(
    query.q || query.service || query.kind !== "all" || query.stage,
  );
}

export function clearOpportunityFiltersHref(
  query: OpportunityQueryState,
): string {
  return buildOpportunitiesHref(query, {
    q: undefined,
    service: undefined,
    kind: "all",
    stage: undefined,
    page: 1,
  });
}

export function isCanonicalOpportunityQuery(
  searchParams: OpportunitySearchParams,
  query: OpportunityQueryState,
): boolean {
  const received = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((item) => received.append(key, item));
    } else if (value !== undefined) {
      received.append(key, value);
    }
  }
  const entries = (params: URLSearchParams) =>
    Array.from(params.entries()).sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey === rightKey
          ? leftValue.localeCompare(rightValue)
          : leftKey.localeCompare(rightKey),
    );
  return (
    JSON.stringify(entries(received)) ===
    JSON.stringify(entries(toOpportunitySearchParams(query)))
  );
}

export function getOpportunityResultRange(
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
