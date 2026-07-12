import { describe, expect, it } from "vitest";
import {
  validateCompanyCreate,
  validateCompanyListOptions,
  validateCompanyUpdate,
} from "./company.validation";

const validInput = {
  legalName: "  ABC (Malaysia),  Sdn Bhd ",
  displayName: " ABC (Malaysia) ",
  companyType: "fnb" as const,
  publicPhone: "04-123 4567",
  publicEmail: " SALES@EXAMPLE.MY ",
  websiteUrl: "https://www.example.my",
  sourceUrl: "https://example.my/contact",
  sourceType: " company website ",
};

describe("company validation", () => {
  it("trims display values and normalises Malaysian contact data", () => {
    const result = validateCompanyCreate(validInput);

    expect(result.legalName).toBe("ABC (Malaysia), Sdn Bhd");
    expect(result.displayName).toBe("ABC (Malaysia)");
    expect(result.publicPhone).toBe("6041234567");
    expect(result.publicEmail).toBe("sales@example.my");
    expect(result.country).toBe("MY");
    expect(result.sourceType).toBe("company website");
    expect(result.discoveredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejects invalid payloads and short phone numbers", () => {
    expect(() =>
      validateCompanyCreate({ ...validInput, legalName: "A" }),
    ).toThrow();
    expect(() =>
      validateCompanyCreate({ ...validInput, publicPhone: "123" }),
    ).toThrow();
  });

  it("rejects an empty update", () => {
    expect(() => validateCompanyUpdate({})).toThrow("At least one field is required");
  });

  it("normalises international phones using the company country", () => {
    expect(
      validateCompanyUpdate({ publicPhone: "+1 (212) 555-0100" }, "US").publicPhone,
    ).toBe("12125550100");
  });

  it("applies safe pagination defaults and limits", () => {
    expect(validateCompanyListOptions({})).toMatchObject({
      page: 1,
      pageSize: 25,
      sortBy: "createdAt",
      sortDirection: "desc",
      includeDeleted: false,
    });
    expect(() => validateCompanyListOptions({ pageSize: 101 })).toThrow();
  });

  it("preserves punctuation in company searches", () => {
    expect(
      validateCompanyListOptions({ query: " ABC (Malaysia), Sdn Bhd " }).query,
    ).toBe("ABC (Malaysia), Sdn Bhd");
  });
});
