import { describe, expect, it, vi } from "vitest";
import { CompanyIntelligenceService } from "./company-intelligence.service";
import { InvalidCompanyIntelligenceOutputError } from "./company-intelligence.service";
import {
  companyIntelligenceEvaluationFixtures,
  validCompanyIntelligence,
} from "./company-intelligence.test-fixtures";
import type { CompanyIntelligenceProvider } from "./company-intelligence.types";

function providerWith(output: unknown): CompanyIntelligenceProvider {
  return {
    generate: vi.fn().mockResolvedValue({ output, usage: null }),
  };
}

describe("Company intelligence structured output", () => {
  it("accepts bounded strict output and normalizes trimmed text", async () => {
    const service = new CompanyIntelligenceService(
      providerWith({ ...validCompanyIntelligence, summary: "  Valid summary  " }),
      "gpt-5.6-terra",
    );

    await expect(
      service.generate(companyIntelligenceEvaluationFixtures.wellPopulatedFnb),
    ).resolves.toMatchObject({
      intelligence: { summary: "Valid summary", confidence: "medium" },
      model: "gpt-5.6-terra",
    });
  });

  it.each([
    ["malformed JSON", "{not-json"],
    ["missing required field", { summary: "Incomplete" }],
    ["extra property", { ...validCompanyIntelligence, extra: "blocked" }],
    [
      "too many list items",
      { ...validCompanyIntelligence, businessSignals: Array(6).fill("Signal") },
    ],
    [
      "oversized string",
      { ...validCompanyIntelligence, summary: "x".repeat(601) },
    ],
    [
      "invalid confidence",
      { ...validCompanyIntelligence, confidence: "certain" },
    ],
    ["empty output", null],
    [
      "generated URL",
      { ...validCompanyIntelligence, summary: "See https://example.test" },
    ],
    [
      "invented browsing claim",
      {
        ...validCompanyIntelligence,
        summary: "I visited the website and confirmed the branch list.",
      },
    ],
    [
      "direct CRM mutation",
      {
        ...validCompanyIntelligence,
        recommendedNextSteps: ["Create this Lead now."],
      },
    ],
    [
      "direct Opportunity creation",
      {
        ...validCompanyIntelligence,
        recommendedNextSteps: ["Create an Opportunity now."],
      },
    ],
    [
      "direct Lead status mutation",
      {
        ...validCompanyIntelligence,
        recommendedNextSteps: ["Set the Lead status to qualified."],
      },
    ],
    [
      "direct named contact instruction",
      {
        ...validCompanyIntelligence,
        recommendedNextSteps: ["Contact John at 0123456789."],
      },
    ],
  ])("rejects %s", async (_name, output) => {
    const service = new CompanyIntelligenceService(
      providerWith(output),
      "gpt-5.6-terra",
    );

    await expect(
      service.generate(companyIntelligenceEvaluationFixtures.wellPopulatedFnb),
    ).rejects.toBeInstanceOf(InvalidCompanyIntelligenceOutputError);
  });

});
