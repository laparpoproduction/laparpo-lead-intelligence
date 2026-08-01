import { describe, expect, it, vi } from "vitest";
import {
  COMPANY_INTELLIGENCE_INPUT_LIMITS,
  COMPANY_INTELLIGENCE_MAX_INPUT_BYTES,
  serializeCompanyIntelligenceInput,
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

  it("sends Fixture I unchanged near the serialized byte ceiling", async () => {
    const { generate, service } = serviceWithProviderSpy();
    const fixture = companyIntelligenceEvaluationFixtures.longButValid;
    const serialized = serializeCompanyIntelligenceInput(fixture);
    const serializedBytes = Buffer.byteLength(serialized, "utf8");
    const utilization = (serializedBytes / COMPANY_INTELLIGENCE_MAX_INPUT_BYTES) * 100;

    expect(serializedBytes).toBe(7_583);
    expect(serializedBytes).toBeGreaterThanOrEqual(7_500);
    expect(serializedBytes).toBeLessThanOrEqual(
      COMPANY_INTELLIGENCE_MAX_INPUT_BYTES,
    );
    expect(utilization).toBeCloseTo(92.57, 2);

    for (const field of [
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
    ] as const) {
      const value = fixture[field];
      if (value !== null) {
        expect(Array.from(value).length).toBeLessThanOrEqual(
          COMPANY_INTELLIGENCE_INPUT_LIMITS[field],
        );
      }
    }
    expect(fixture.estimatedBranchCount).toBeLessThanOrEqual(
      COMPANY_INTELLIGENCE_INPUT_LIMITS.estimatedBranchCount,
    );

    await expect(service.generate(fixture)).resolves.toMatchObject({
      intelligence: validCompanyIntelligence,
    });
    expect(generate).toHaveBeenCalledOnce();

    const request = generate.mock.calls[0]?.[0];
    expect(request).toBeDefined();
    const userContent = request!.input[1].content;
    const serializedAtProvider = userContent
      .split("<company_data>\n")[1]
      ?.split("\n</company_data>")[0];

    expect(serializedAtProvider).toBe(serialized);
    expect(JSON.parse(serializedAtProvider!)).toEqual(fixture);
  });
});
