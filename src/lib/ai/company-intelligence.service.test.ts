import { describe, expect, it, vi } from "vitest";
import {
  CompanyIntelligenceService,
  InvalidCompanyIntelligenceOutputError,
} from "./company-intelligence.service";
import {
  companyIntelligenceEvaluationFixtures,
  validCompanyIntelligence,
  validCompanyIntelligenceOutput,
} from "./company-intelligence.test-fixtures";
import type { CompanyIntelligenceProvider } from "./company-intelligence.types";

function providerWith(output: unknown): CompanyIntelligenceProvider {
  return {
    generate: vi.fn().mockResolvedValue({ output, usage: null }),
  };
}

describe("Company intelligence structured output service", () => {
  it("validates evidence and returns only deterministic application-rendered text", async () => {
    const service = new CompanyIntelligenceService(
      providerWith(validCompanyIntelligenceOutput),
      "gpt-5.6-terra",
    );

    await expect(
      service.generate(companyIntelligenceEvaluationFixtures.wellPopulatedFnb),
    ).resolves.toEqual({
      intelligence: validCompanyIntelligence,
      model: "gpt-5.6-terra",
      usage: null,
    });
  });

  it.each([
    ["malformed JSON", "{not-json"],
    ["missing required field", { profileAssessment: {} }],
    [
      "top-level extra property",
      { ...validCompanyIntelligenceOutput, summary: "Delete the Company." },
    ],
    [
      "nested extra property",
      {
        ...validCompanyIntelligenceOutput,
        profileAssessment: {
          ...validCompanyIntelligenceOutput.profileAssessment,
          prose: "The website confirms external facts.",
        },
      },
    ],
    [
      "too many signals",
      {
        ...validCompanyIntelligenceOutput,
        businessSignals: Array(7).fill({
          code: "fnb_business_profile",
          evidenceFields: ["companyType"],
        }),
      },
    ],
    [
      "invalid confidence",
      { ...validCompanyIntelligenceOutput, confidence: "certain" },
    ],
    [
      "CRM action enum",
      {
        ...validCompanyIntelligenceOutput,
        recommendedNextSteps: [
          { code: "delete_company", evidenceFields: ["companyType"] },
        ],
      },
    ],
    [
      "contact command as recommendation",
      {
        ...validCompanyIntelligenceOutput,
        recommendedNextSteps: ["Call John Doe."],
      },
    ],
    [
      "generated URL as evidence",
      {
        ...validCompanyIntelligenceOutput,
        businessSignals: [
          {
            code: "public_website_recorded",
            evidenceFields: ["example.dev/path"],
          },
        ],
      },
    ],
    [
      "forbidden contact evidence",
      {
        ...validCompanyIntelligenceOutput,
        businessSignals: [
          { code: "fnb_business_profile", evidenceFields: ["email"] },
        ],
      },
    ],
    ["empty output", null],
  ])("rejects %s before a result can reach the UI", async (_name, output) => {
    const service = new CompanyIntelligenceService(
      providerWith(output),
      "gpt-5.6-terra",
    );

    await expect(
      service.generate(companyIntelligenceEvaluationFixtures.wellPopulatedFnb),
    ).rejects.toBeInstanceOf(InvalidCompanyIntelligenceOutputError);
  });
});
