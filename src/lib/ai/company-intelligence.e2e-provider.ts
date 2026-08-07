import "server-only";

import { appendFile } from "node:fs/promises";
import path from "node:path";
import type {
  CompanyIntelligenceProvider,
  CompanyIntelligenceProviderResult,
} from "./company-intelligence.types";

export const deterministicE2ECompanyIntelligenceOutput = {
  profileAssessment: {
    code: "well_populated_public_profile",
    evidenceFields: [
      "companyType",
      "industry",
      "description",
      "city",
      "state",
      "websiteUrl",
    ],
  },
  businessSignals: [
    { code: "fnb_business_profile", evidenceFields: ["companyType"] },
    {
      code: "public_description_present",
      evidenceFields: ["description"],
    },
    { code: "public_website_recorded", evidenceFields: ["websiteUrl"] },
    {
      code: "location_recorded",
      evidenceFields: ["city", "state", "country"],
    },
    {
      code: "branch_count_recorded",
      evidenceFields: ["estimatedBranchCount"],
    },
    {
      code: "potential_content_partnership_fit",
      evidenceFields: ["companyType", "industry"],
    },
  ],
  dataQualityGaps: [],
  recommendedNextSteps: [
    {
      code: "review_public_company_profile",
      evidenceFields: ["displayName"],
    },
    {
      code: "verify_branch_count_manually",
      evidenceFields: ["estimatedBranchCount"],
    },
    {
      code: "assess_content_partnership_fit",
      evidenceFields: ["companyType", "industry"],
    },
    {
      code: "review_available_public_provenance",
      evidenceFields: ["sourceType"],
    },
  ],
} as const;

function assertSafeCallsFile(callsFile: string): string {
  const resolved = path.resolve(callsFile);
  const allowedDirectory = path.resolve(
    process.cwd(),
    ".tmp/authenticated-e2e",
  );
  if (!resolved.startsWith(`${allowedDirectory}${path.sep}`)) {
    throw new Error("Authenticated E2E AI call counter path is invalid");
  }
  return resolved;
}

export class DeterministicE2ECompanyIntelligenceProvider
  implements CompanyIntelligenceProvider
{
  private readonly callsFile: string;

  constructor(callsFile: string) {
    this.callsFile = assertSafeCallsFile(callsFile);
  }

  async generate(): Promise<CompanyIntelligenceProviderResult> {
    await appendFile(this.callsFile, "call\n", { encoding: "utf8" });
    return {
      output: deterministicE2ECompanyIntelligenceOutput,
      usage: null,
    };
  }
}
