import { z } from "zod";
import {
  contactSortFields,
  contactStatusValues,
  type ContactListOptions,
  type ContactSortDirection,
  type ContactSortField,
  type ContactStatus,
} from "./contact.types";

export type ContactSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type ContactQueryState = {
  q?: string;
  companyId?: string;
  assignedTo?: string;
  createdBy?: string;
  contactStatus?: ContactStatus;
  isPrimaryContact?: boolean;
  sortBy: ContactSortField;
  sortDirection: ContactSortDirection;
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
  createdBy: optionalUuid,
  contactStatus: z
    .preprocess(firstValue, z.enum(contactStatusValues).optional())
    .catch(undefined),
  isPrimaryContact: z
    .preprocess(
      firstValue,
      z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
    )
    .catch(undefined),
  sortBy: z
    .preprocess(firstValue, z.enum(contactSortFields))
    .catch("createdAt"),
  sortDirection: z
    .preprocess(firstValue, z.enum(["asc", "desc"]))
    .catch("desc"),
  page: z
    .preprocess(firstValue, z.coerce.number().int().positive().max(1_000_000))
    .catch(1),
});

function fromUrlSearchParams(searchParams: URLSearchParams): ContactSearchParams {
  const input: ContactSearchParams = {};
  for (const key of new Set(searchParams.keys())) {
    input[key] = searchParams.getAll(key);
  }
  return input;
}

export function parseContactQueryState(
  searchParams: ContactSearchParams | URLSearchParams,
): ContactQueryState {
  return querySchema.parse(
    searchParams instanceof URLSearchParams
      ? fromUrlSearchParams(searchParams)
      : searchParams,
  );
}

export function toContactListOptions(
  query: ContactQueryState,
  pageSize: number,
): ContactListOptions {
  return {
    query: query.q,
    companyId: query.companyId,
    assignedTo: query.assignedTo,
    createdBy: query.createdBy,
    contactStatus: query.contactStatus,
    isPrimaryContact: query.isPrimaryContact,
    sortBy: query.sortBy,
    sortDirection: query.sortDirection,
    page: query.page,
    pageSize,
  };
}

export function toContactSearchParams(
  query: ContactQueryState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.companyId) params.set("companyId", query.companyId);
  if (query.assignedTo) params.set("assignedTo", query.assignedTo);
  if (query.createdBy) params.set("createdBy", query.createdBy);
  if (query.contactStatus) params.set("contactStatus", query.contactStatus);
  if (query.isPrimaryContact !== undefined) {
    params.set("isPrimaryContact", String(query.isPrimaryContact));
  }
  if (query.sortBy !== "createdAt") params.set("sortBy", query.sortBy);
  if (query.sortDirection !== "desc") {
    params.set("sortDirection", query.sortDirection);
  }
  if (query.page > 1) params.set("page", String(query.page));
  return params;
}

export function buildContactsHref(
  query: ContactQueryState,
  updates: Partial<ContactQueryState> = {},
): string {
  const params = toContactSearchParams({ ...query, ...updates });
  const search = params.toString();
  return search ? `/contacts?${search}` : "/contacts";
}

export function hasContactFilters(query: ContactQueryState): boolean {
  return Boolean(
    query.q ||
      query.companyId ||
      query.assignedTo ||
      query.createdBy ||
      query.contactStatus ||
      query.isPrimaryContact !== undefined,
  );
}

export function clearContactFiltersHref(query: ContactQueryState): string {
  return buildContactsHref(query, {
    q: undefined,
    companyId: undefined,
    assignedTo: undefined,
    createdBy: undefined,
    contactStatus: undefined,
    isPrimaryContact: undefined,
    page: 1,
  });
}

export function isCanonicalContactQuery(
  searchParams: ContactSearchParams,
  query: ContactQueryState,
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
    JSON.stringify(entries(toContactSearchParams(query)))
  );
}

export function getContactResultRange(
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
