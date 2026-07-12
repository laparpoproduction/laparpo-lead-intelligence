import { describe, expect, it } from "vitest";
import { mapCompanyCreate, mapCompanyRow, mapCompanyUpdate } from "./company.mapper";
import { validateCompanyCreate } from "./company.validation";
import { companyFixture, companyRowFixture, userId } from "./company.test-fixtures";

describe("company mapper", () => {
  it("maps a database row into the domain model", () => {
    expect(mapCompanyRow(companyRowFixture)).toEqual(companyFixture);
  });

  it("maps a validated create payload and derives its domain", () => {
    const input = validateCompanyCreate({
      legalName: "ABC (Malaysia), Sdn Bhd",
      displayName: "ABC (Malaysia)",
      companyType: "fnb",
      websiteUrl: "https://www.Example.my/menu",
      sourceUrl: "https://example.my/contact",
      sourceType: "company_website",
    });

    expect(mapCompanyCreate(input, userId)).toMatchObject({
      legal_name: "ABC (Malaysia), Sdn Bhd",
      website_domain: "example.my",
      created_by: userId,
      country: "MY",
    });
  });

  it("maps only supplied update fields and clears the domain with its URL", () => {
    expect(mapCompanyUpdate({ city: "Butterworth" })).toEqual({ city: "Butterworth" });
    expect(mapCompanyUpdate({ websiteUrl: null })).toEqual({
      website_url: null,
      website_domain: null,
    });
  });
});
