import { describe, expect, it } from "vitest";
import {
  parseCreateCompanyForm,
  parseDeleteCompanyForm,
  parseUpdateCompanyForm,
} from "./company-form";

function validCreateForm(): FormData {
  const form = new FormData();
  form.set("legalName", "  ABC (Malaysia), Sdn Bhd ");
  form.set("displayName", " ABC (Malaysia) ");
  form.set("companyType", "fnb");
  form.set("publicPhone", "");
  form.set("estimatedBranchCount", "12");
  form.set("sourceUrl", "https://example.my/about");
  form.set("sourceType", " company_website ");
  form.set("discoveredAt", "2026-07-12T08:00:00.000Z");
  return form;
}

describe("company FormData parsing", () => {
  it("trims strings, converts empty optional fields, numbers, and timestamps", () => {
    const parsed = parseCreateCompanyForm(validCreateForm());

    expect(parsed.input).toMatchObject({
      legalName: "ABC (Malaysia), Sdn Bhd",
      displayName: "ABC (Malaysia)",
      publicPhone: null,
      estimatedBranchCount: 12,
      sourceType: "company_website",
      discoveredAt: "2026-07-12T08:00:00.000Z",
    });
  });

  it("rejects malformed numbers and timestamps", () => {
    const numberForm = validCreateForm();
    numberForm.set("estimatedBranchCount", "twelve");
    expect(() => parseCreateCompanyForm(numberForm)).toThrow();

    const dateForm = validCreateForm();
    dateForm.set("discoveredAt", "next Tuesday");
    expect(() => parseCreateCompanyForm(dateForm)).toThrow();
  });

  it("parses partial updates and rejects empty updates", () => {
    const update = new FormData();
    update.set("companyId", "22222222-2222-4222-8222-222222222222");
    update.set("city", " Butterworth ");
    expect(parseUpdateCompanyForm(update).input).toEqual({ city: "Butterworth" });

    const empty = new FormData();
    empty.set("companyId", "22222222-2222-4222-8222-222222222222");
    expect(() => parseUpdateCompanyForm(empty)).toThrow();
  });

  it("requires an explicit soft-delete confirmation", () => {
    const form = new FormData();
    form.set("companyId", "22222222-2222-4222-8222-222222222222");
    expect(() => parseDeleteCompanyForm(form)).toThrow();
    form.set("confirm", "on");
    expect(parseDeleteCompanyForm(form)).toEqual({
      companyId: "22222222-2222-4222-8222-222222222222",
      confirm: true,
    });
  });
});
