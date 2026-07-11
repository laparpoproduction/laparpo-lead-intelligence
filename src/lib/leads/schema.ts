import { z } from "zod";

const optionalUrl = z
  .union([z.literal(""), z.url()])
  .transform((value) => value || undefined)
  .optional();
const optionalEmail = z
  .union([z.literal(""), z.email()])
  .transform((value) => value.toLowerCase() || undefined)
  .optional();

export const publicLeadSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  category: z.enum(["fnb", "agency", "hotel", "other"]),
  website: optionalUrl,
  publicEmail: optionalEmail,
  publicPhone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).default("Penang"),
  sourceUrl: z.url(),
  discoveredAt: z.iso.datetime(),
  sourceType: z.enum(["business_directory", "company_website", "event_listing", "manual"]),
  notes: z.string().trim().max(2000).optional(),
});

export type PublicLeadInput = z.infer<typeof publicLeadSchema>;
