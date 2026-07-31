import { describe, expect, it, vi } from "vitest";
import {
  COMPANY_INTELLIGENCE_INPUT_LIMITS,
  COMPANY_INTELLIGENCE_MAX_INPUT_BYTES,
} from "./company-intelligence.input";
import { CompanyIntelligenceService } from "./company-intelligence.service";
import {
  companyIntelligenceEvaluationFixtures,
  validCompanyIntelligence,
} from "./company-intelligence.test-fixtures";
import type {
  CompanyIntelligenceProjection,
  CompanyIntelligenceProvider,
} from "./company-intelligence.types";

function serviceWithProviderSpy() {
  const generate = vi.fn().mockResolvedValue({
    output: validCompanyIntelligence,
    usage: null,
  });
  const provider: CompanyIntelligenceProvider = { generate };
  return {
    generate,
    service: new CompanyIntelligenceService(provider, "gpt-5.6-terra"),
  };
}

describe("Company intelligence input boundary", () => {
  it.each([
    [
      "legalName",
      {
        legalName: "L".repeat(
          COMPANY_INTELLIGENCE_INPUT_LIMITS.legalName + 1,
        ),
      },
    ],
    [
      "displayName",
      {
        displayName: "D".repeat(
          COMPANY_INTELLIGENCE_INPUT_LIMITS.displayName + 1,
        ),
      },
    ],
    [
      "industry",
      {
        industry: "I".repeat(
          COMPANY_INTELLIGENCE_INPUT_LIMITS.industry + 1,
        ),
      },
    ],
    [
      "description",
      {
        description: "D".repeat(
          COMPANY_INTELLIGENCE_INPUT_LIMITS.description + 1,
        ),
      },
    ],
    [
      "city",
      {
        city: "C".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.city + 1),
      },
    ],
    [
      "state",
      {
        state: "S".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.state + 1),
      },
    ],
    [
      "country",
      {
        country: "MYS",
      },
    ],
    [
      "websiteUrl",
      {
        websiteUrl: "W".repeat(
          COMPANY_INTELLIGENCE_INPUT_LIMITS.websiteUrl + 1,
        ),
      },
    ],
    [
      "sourceUrl",
      {
        sourceUrl: "S".repeat(
          COMPANY_INTELLIGENCE_INPUT_LIMITS.sourceUrl + 1,
        ),
      },
    ],
    [
      "sourceType",
      {
        sourceType: "S".repeat(
          COMPANY_INTELLIGENCE_INPUT_LIMITS.sourceType + 1,
        ),
      },
    ],
    [
      "estimatedBranchCount",
      {
        estimatedBranchCount:
          COMPANY_INTELLIGENCE_INPUT_LIMITS.estimatedBranchCount + 1,
      },
    ],
  ] satisfies [string, Partial<CompanyIntelligenceProjection>][])(
    "rejects oversized %s before provider invocation",
    async (category, override) => {
      const { generate, service } = serviceWithProviderSpy();

      await expect(
        service.generate({
          ...companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
          ...override,
        }),
      ).rejects.toMatchObject({
        name: "CompanyIntelligenceInputTooLargeError",
        category,
      });
      expect(generate).not.toHaveBeenCalled();
    },
  );

  it("rejects an oversized serialized payload even when every ASCII field is individually valid", async () => {
    const { generate, service } = serviceWithProviderSpy();
    const individuallyValid: CompanyIntelligenceProjection = {
      ...companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
      legalName: "L".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.legalName),
      displayName: "D".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.displayName),
      industry: "I".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.industry),
      description: "\\".repeat(
        COMPANY_INTELLIGENCE_INPUT_LIMITS.description,
      ),
      city: "C".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.city),
      state: "S".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.state),
      websiteUrl: "W".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.websiteUrl),
      sourceUrl: "S".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.sourceUrl),
      sourceType: "T".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.sourceType),
    };

    await expect(service.generate(individuallyValid)).rejects.toMatchObject({
      name: "CompanyIntelligenceInputTooLargeError",
      category: "serializedInputBytes",
      limit: COMPANY_INTELLIGENCE_MAX_INPUT_BYTES,
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("accepts ordinary ASCII values at every per-field maximum within the global ceiling", async () => {
    const { generate, service } = serviceWithProviderSpy();
    const websitePrefix = "https://example.test/";
    const sourcePrefix = "https://directory.example.test/";
    const maximumInput: CompanyIntelligenceProjection = {
      ...companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
      legalName: "L".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.legalName),
      displayName: "D".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.displayName),
      industry: "I".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.industry),
      description: "D".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.description),
      city: "C".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.city),
      state: "S".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.state),
      country: "MY",
      estimatedBranchCount:
        COMPANY_INTELLIGENCE_INPUT_LIMITS.estimatedBranchCount,
      websiteUrl:
        websitePrefix +
        "w".repeat(
          COMPANY_INTELLIGENCE_INPUT_LIMITS.websiteUrl -
            websitePrefix.length,
        ),
      sourceUrl:
        sourcePrefix +
        "s".repeat(
          COMPANY_INTELLIGENCE_INPUT_LIMITS.sourceUrl - sourcePrefix.length,
        ),
      sourceType: "T".repeat(COMPANY_INTELLIGENCE_INPUT_LIMITS.sourceType),
    };

    await expect(service.generate(maximumInput)).resolves.toMatchObject({
      intelligence: validCompanyIntelligence,
    });
    expect(generate).toHaveBeenCalledOnce();
  });

  it("uses UTF-8 bytes for the total limit and rejects multibyte input before provider invocation", async () => {
    const { generate, service } = serviceWithProviderSpy();
    const unicodeInput: CompanyIntelligenceProjection = {
      ...companyIntelligenceEvaluationFixtures.wellPopulatedFnb,
      description: "😀".repeat(
        COMPANY_INTELLIGENCE_INPUT_LIMITS.description,
      ),
    };

    await expect(service.generate(unicodeInput)).rejects.toMatchObject({
      name: "CompanyIntelligenceInputTooLargeError",
      category: "serializedInputBytes",
    });
    expect(generate).not.toHaveBeenCalled();
  });
});
