import { describe, expect, it } from "vitest";
import {
  validateContactCreate,
  validateContactListOptions,
  validateContactUpdate,
} from "./contact.validation";
import { companyId, creatorId } from "./contact.test-fixtures";

const validCreate = {
  companyId,
  fullName: "  Nur Aisyah   binti Ahmad ",
  workEmail: " AISYAH@EXAMPLE.MY ",
  mobilePhone: "012-345 6789",
  whatsappPhone: "+60 12-345 6789",
  linkedinUrl: "WWW.LINKEDIN.COM/in/Nur-Aisyah/?trk=public",
  sourceUrl: "https://example.my/team/nur-aisyah",
  sourceType: " company website ",
  discoveredAt: "2026-07-10T00:00:00.000Z",
};

describe("contact validation", () => {
  it("normalizes create input while preserving a cultural display name", () => {
    expect(validateContactCreate(validCreate)).toMatchObject({
      fullName: "Nur Aisyah binti Ahmad",
      workEmail: "aisyah@example.my",
      mobilePhone: "60123456789",
      whatsappPhone: "60123456789",
      linkedinUrl: "https://www.linkedin.com/in/nur-aisyah",
      sourceType: "company website",
      isPrimaryContact: false,
      contactStatus: "discovered",
    });
  });

  it("derives fullName only when the source supplies name parts without one", () => {
    const parsed = validateContactCreate({
      firstName: "Siti Nur",
      lastName: "A/P Rajan",
      sourceUrl: "https://example.my/team/siti",
      sourceType: "public_directory",
      discoveredAt: "2026-07-10T00:00:00.000Z",
    });
    expect(parsed.fullName).toBe("Siti Nur A/P Rajan");
    expect(parsed.firstName).toBe("Siti Nur");
    expect(parsed.lastName).toBe("A/P Rajan");
  });

  it("requires identity and public source provenance", () => {
    expect(() =>
      validateContactCreate({
        sourceUrl: "https://example.my/team",
        sourceType: "directory",
        discoveredAt: "2026-07-10T00:00:00.000Z",
      }),
    ).toThrow();
    expect(() => validateContactCreate({ fullName: "No Source" } as never)).toThrow();
  });

  it.each([
    { input: { ...validCreate, workEmail: "not-an-email" }, label: "email" },
    { input: { ...validCreate, mobilePhone: "123" }, label: "phone" },
    { input: { ...validCreate, linkedinUrl: "https://example.my/person" }, label: "LinkedIn URL" },
    { input: { ...validCreate, companyId: "not-a-uuid" }, label: "company ID" },
    { input: { ...validCreate, discoveredAt: "yesterday" }, label: "timestamp" },
    {
      input: {
        ...validCreate,
        lastVerifiedAt: "2026-07-09T00:00:00.000Z",
      },
      label: "verification timestamp",
    },
  ])("rejects invalid $label", ({ input }) => {
    expect(() => validateContactCreate(input)).toThrow();
  });

  it("accepts a normalized partial update and rejects empty or protected fields", () => {
    expect(validateContactUpdate({ workEmail: " NEW@EXAMPLE.MY " })).toEqual({
      workEmail: "new@example.my",
    });
    expect(() => validateContactUpdate({})).toThrow();
    expect(() => validateContactUpdate({ createdBy: creatorId } as never)).toThrow();
    expect(() => validateContactUpdate({ deletedAt: null } as never)).toThrow();
    expect(() => validateContactUpdate({ sourceUrl: null } as never)).toThrow();
    expect(() => validateContactUpdate({ sourceType: "" })).toThrow();
  });

  it("bounds and validates list options", () => {
    expect(validateContactListOptions({})).toMatchObject({
      page: 1,
      pageSize: 25,
      sortBy: "createdAt",
      sortDirection: "desc",
    });
    expect(() => validateContactListOptions({ pageSize: 101 })).toThrow();
    expect(() => validateContactListOptions({ sortBy: "email" as never })).toThrow();
  });
});
