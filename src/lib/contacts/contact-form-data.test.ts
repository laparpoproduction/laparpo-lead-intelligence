import { describe, expect, it } from "vitest";
import {
  parseCreateContactForm,
  parseDeleteContactForm,
  parseUpdateContactForm,
} from "./contact-form-data";
import { companyId, contactId, creatorId } from "./contact.test-fixtures";

function createForm(): FormData {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("fullName", "  Nur Aisyah   binti Ahmad ");
  form.set("workEmail", " AISYAH@EXAMPLE.MY ");
  form.set("mobilePhone", "012-345 6789");
  form.set("sourceUrl", "https://example.my/team/nur-aisyah");
  form.set("sourceType", " company website ");
  form.set("discoveredAt", "2026-07-10T00:00:00.000Z");
  return form;
}

describe("Contact FormData parser", () => {
  it("parses and normalizes every supported create value", () => {
    const form = createForm();
    form.set("firstName", "Nur Aisyah");
    form.set("lastName", "binti Ahmad");
    form.set("jobTitle", " Marketing Director ");
    form.set("department", " Marketing ");
    form.set("seniority", " Senior ");
    form.set("personalEmail", " PERSONAL@EXAMPLE.MY ");
    form.set("publicPhone", "04-555 0100");
    form.set("whatsappPhone", "+60 12-345 6789");
    form.set("linkedinUrl", "linkedin.com/in/Nur-Aisyah");
    form.set("facebookUrl", "facebook.com/Nur.Aisyah");
    form.set("instagramUrl", "instagram.com/Nur.Aisyah");
    form.set("lastVerifiedAt", "2026-07-11T00:00:00.000Z");
    form.set("isPrimaryContact", "on");
    form.set("contactStatus", "verified");
    form.set("notes", " Publicly listed contact. ");
    form.set("assignedTo", creatorId);

    expect(parseCreateContactForm(form).input).toMatchObject({
      fullName: "Nur Aisyah binti Ahmad",
      workEmail: "aisyah@example.my",
      personalEmail: "personal@example.my",
      mobilePhone: "60123456789",
      whatsappPhone: "60123456789",
      isPrimaryContact: true,
      contactStatus: "verified",
      assignedTo: creatorId,
    });
  });

  it("converts empty optional values consistently", () => {
    const form = createForm();
    form.set("companyId", "");
    form.set("personalEmail", "   ");
    form.set("lastVerifiedAt", "");
    form.set("assignedTo", "");
    form.set("isPrimaryContact", "false");

    expect(parseCreateContactForm(form).input).toMatchObject({
      companyId: null,
      personalEmail: null,
      lastVerifiedAt: null,
      assignedTo: null,
      isPrimaryContact: false,
    });
  });

  it.each([
    ["companyId", "not-a-uuid"],
    ["workEmail", "not-an-email"],
    ["mobilePhone", "123"],
    ["linkedinUrl", "https://example.my/person"],
    ["discoveredAt", "yesterday"],
    ["isPrimaryContact", "perhaps"],
  ])("rejects malformed %s", (field, value) => {
    const form = createForm();
    form.set(field, value);
    expect(() => parseCreateContactForm(form)).toThrow();
  });

  it("parses partial updates and rejects empty updates", () => {
    const form = new FormData();
    form.set("contactId", contactId);
    form.set("workEmail", " NEW@EXAMPLE.MY ");
    form.set("isPrimaryContact", "0");
    form.set("confirmationToken", " signed-token ");
    form.set("createdBy", creatorId);
    form.set("deletedAt", "2026-07-13T00:00:00.000Z");

    expect(parseUpdateContactForm(form)).toEqual({
      contactId,
      input: { workEmail: "new@example.my", isPrimaryContact: false },
      confirmationToken: "signed-token",
    });

    const empty = new FormData();
    empty.set("contactId", contactId);
    expect(() => parseUpdateContactForm(empty)).toThrow();
  });

  it("requires an explicit delete confirmation", () => {
    const form = new FormData();
    form.set("contactId", contactId);
    expect(() => parseDeleteContactForm(form)).toThrow();
    form.set("confirm", "true");
    expect(parseDeleteContactForm(form)).toEqual({ contactId, confirm: true });
  });
});
