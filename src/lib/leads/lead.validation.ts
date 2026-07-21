import { z } from "zod";
import {
  leadPriorityValues,
  leadQualificationValues,
  leadServiceInterestValues,
  leadSortFields,
  leadSourceTypeValues,
  leadStageValues,
  leadStatusValues,
  type CreateLeadInput,
  type LeadListOptions,
  type UpdateLeadInput,
  type ValidatedCreateLeadInput,
  type ValidatedLeadListOptions,
} from "./lead.types";

import { normalizeLeadCurrency, normalizeLeadText } from "./lead-normalization";

const compactText = (value: string) => normalizeLeadText(value) ?? "";
const nullableText = z.string().transform(compactText).pipe(z.string().min(1)).nullable().optional();
const optionalUrl = z.string().trim().pipe(z.url({ protocol: /^https?$/ })).nullable().optional();
const timestamp = z.iso.datetime({ offset: true });
const date = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDate = date.nullable().optional();
const nullableUuid = z.uuid().nullable().optional();
const currency = z.string().transform((value) => normalizeLeadCurrency(value) ?? "MYR");

const leadFields = {
  companyId: nullableUuid,
  primaryContactId: nullableUuid,
  title: z.string().transform(compactText).pipe(z.string().min(2).max(240)),
  stage: z.enum(leadStageValues).default("new"),
  leadStatus: z.enum(leadStatusValues).default("active"),
  qualificationStatus: z.enum(leadQualificationValues).default("unreviewed"),
  priority: z.enum(leadPriorityValues).default("normal"),
  leadScore: z.number().int().nonnegative().max(100).nullable().optional(),
  estimatedValue: z.number().nonnegative().nullable().optional(),
  currency: currency.default("MYR"),
  serviceInterest: z.enum(leadServiceInterestValues).nullable().optional(),
  assignedTo: nullableUuid,
  sourceType: z.enum(leadSourceTypeValues).default("manual"),
  sourceUrl: optionalUrl,
  sourceSignalId: nullableUuid,
  sourceCampaign: nullableText,
  referralName: nullableText,
  discoveredAt: timestamp,
  lastVerifiedAt: timestamp.nullable().optional(),
  businessNeed: nullableText,
  budgetNotes: nullableText,
  timelineNotes: nullableText,
  decisionMakerNotes: nullableText,
  expectedCloseDate: optionalDate,
  nextStep: nullableText,
  nextFollowUpAt: timestamp.nullable().optional(),
  lastContactedAt: timestamp.nullable().optional(),
  notes: nullableText,
  convertedAt: timestamp.nullable().optional(),
  lostAt: timestamp.nullable().optional(),
  lostReason: nullableText,
  disqualifiedAt: timestamp.nullable().optional(),
  disqualifiedReason: nullableText,
};

const createLeadSchema = z.object({
  ...leadFields,
  title: leadFields.title.default("Lead"),
  currency: leadFields.currency.default("MYR"),
  sourceType: leadFields.sourceType.default("manual"),
  discoveredAt: leadFields.discoveredAt.default(() => new Date().toISOString()),
}).superRefine((value, context) => {
  if (value.lastVerifiedAt && value.lastVerifiedAt < value.discoveredAt) {
    context.addIssue({ code: "custom", path: ["lastVerifiedAt"], message: "Verification cannot precede discovery" });
  }
  if (value.nextFollowUpAt && value.nextFollowUpAt < value.discoveredAt) {
    context.addIssue({ code: "custom", path: ["nextFollowUpAt"], message: "Follow-up cannot precede discovery" });
  }
});

const updateLeadSchema = z.object(leadFields).partial().refine((value) => Object.keys(value).length > 0, "At least one field is required");

const listSchema = z.object({
  query: z.string().trim().min(1).transform((value) => normalizeLeadText(value) ?? value).optional(),
  companyId: z.uuid().optional(),
  assignedTo: z.uuid().optional(),
  createdBy: z.uuid().optional(),
  stage: z.enum(leadStageValues).optional(),
  leadStatus: z.enum(leadStatusValues).optional(),
  qualificationStatus: z.enum(leadQualificationValues).optional(),
  priority: z.enum(leadPriorityValues).optional(),
  includeDeleted: z.boolean().default(false),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
  sortBy: z.enum(leadSortFields).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export function validateLeadCreate(input: CreateLeadInput): ValidatedCreateLeadInput {
  return createLeadSchema.parse(input) as ValidatedCreateLeadInput;
}

export function validateLeadUpdate(input: UpdateLeadInput): UpdateLeadInput {
  return updateLeadSchema.parse(input);
}

export function validateLeadListOptions(options: LeadListOptions = {}): ValidatedLeadListOptions {
  return listSchema.parse(options) as ValidatedLeadListOptions;
}

export function validateLeadId(value: string): string {
  return z.uuid().parse(value);
}
