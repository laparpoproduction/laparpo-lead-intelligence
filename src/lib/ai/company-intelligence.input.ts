import type { CompanyIntelligenceProjection } from "./company-intelligence.types";

export const COMPANY_INTELLIGENCE_INPUT_LIMITS = {
  legalName: 200,
  displayName: 200,
  industry: 120,
  description: 2_000,
  city: 120,
  state: 120,
  country: 2,
  websiteUrl: 2_048,
  sourceUrl: 2_048,
  sourceType: 100,
  estimatedBranchCount: 100_000,
} as const;

export const COMPANY_INTELLIGENCE_MAX_INPUT_BYTES = 8 * 1_024;

type CompanyIntelligenceInputLimitCategory =
  | keyof typeof COMPANY_INTELLIGENCE_INPUT_LIMITS
  | "serializedInputBytes";

export class CompanyIntelligenceInputTooLargeError extends Error {
  constructor(
    readonly category: CompanyIntelligenceInputLimitCategory,
    readonly actualSize: number,
    readonly limit: number,
  ) {
    super("Company intelligence input exceeds a safe limit");
    this.name = "CompanyIntelligenceInputTooLargeError";
  }
}

const stringFields = [
  "legalName",
  "displayName",
  "industry",
  "description",
  "city",
  "state",
  "country",
  "websiteUrl",
  "sourceUrl",
  "sourceType",
] as const;

function characterCount(value: string): number {
  return Array.from(value).length;
}

export function serializeCompanyIntelligenceInput(
  company: CompanyIntelligenceProjection,
): string {
  for (const field of stringFields) {
    const value = company[field];
    if (value === null) continue;

    const actualSize = characterCount(value);
    const limit = COMPANY_INTELLIGENCE_INPUT_LIMITS[field];
    if (actualSize > limit) {
      throw new CompanyIntelligenceInputTooLargeError(
        field,
        actualSize,
        limit,
      );
    }
  }

  if (
    company.estimatedBranchCount !== null &&
    company.estimatedBranchCount >
      COMPANY_INTELLIGENCE_INPUT_LIMITS.estimatedBranchCount
  ) {
    throw new CompanyIntelligenceInputTooLargeError(
      "estimatedBranchCount",
      company.estimatedBranchCount,
      COMPANY_INTELLIGENCE_INPUT_LIMITS.estimatedBranchCount,
    );
  }

  const serialized = JSON.stringify(company);
  const actualSize = Buffer.byteLength(serialized, "utf8");
  if (actualSize > COMPANY_INTELLIGENCE_MAX_INPUT_BYTES) {
    throw new CompanyIntelligenceInputTooLargeError(
      "serializedInputBytes",
      actualSize,
      COMPANY_INTELLIGENCE_MAX_INPUT_BYTES,
    );
  }

  return serialized;
}
