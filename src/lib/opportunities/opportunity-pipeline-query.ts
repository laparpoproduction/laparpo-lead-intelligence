import { z } from "zod";
import {
  opportunityKindValues,
  opportunityServiceValues,
  type OpportunityKind,
  type OpportunityPipelineFilters,
  type OpportunityService,
} from "./opportunity.types";
import type { OpportunitySearchParams } from "./opportunity-query";

export type OpportunityPipelineQueryState = {
  q?: string;
  service?: OpportunityService;
  kind: OpportunityKind;
};

const firstValue = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value;

const pipelineQuerySchema = z.object({
  q: z
    .preprocess(firstValue, z.string().trim().min(1).max(200).optional())
    .catch(undefined),
  service: z
    .preprocess(firstValue, z.enum(opportunityServiceValues).optional())
    .catch(undefined),
  kind: z
    .preprocess(firstValue, z.enum(opportunityKindValues))
    .catch("all"),
});

export function parseOpportunityPipelineQuery(
  searchParams: OpportunitySearchParams | URLSearchParams,
): OpportunityPipelineQueryState {
  const input =
    searchParams instanceof URLSearchParams
      ? Object.fromEntries(searchParams.entries())
      : searchParams;
  return pipelineQuerySchema.parse(input);
}

export function toOpportunityPipelineFilters(
  query: OpportunityPipelineQueryState,
): OpportunityPipelineFilters {
  return {
    query: query.q,
    service: query.service,
    kind: query.kind,
  };
}

export function toOpportunityPipelineSearchParams(
  query: OpportunityPipelineQueryState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.service) params.set("service", query.service);
  if (query.kind !== "all") params.set("kind", query.kind);
  return params;
}

export function buildOpportunityPipelineHref(
  query: OpportunityPipelineQueryState,
  updates: Partial<OpportunityPipelineQueryState> = {},
): string {
  const search = toOpportunityPipelineSearchParams({
    ...query,
    ...updates,
  }).toString();
  return search
    ? `/opportunities/pipeline?${search}`
    : "/opportunities/pipeline";
}

export function hasOpportunityPipelineFilters(
  query: OpportunityPipelineQueryState,
): boolean {
  return Boolean(query.q || query.service || query.kind !== "all");
}

export function isCanonicalOpportunityPipelineQuery(
  searchParams: OpportunitySearchParams,
  query: OpportunityPipelineQueryState,
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
    JSON.stringify(entries(toOpportunityPipelineSearchParams(query)))
  );
}
