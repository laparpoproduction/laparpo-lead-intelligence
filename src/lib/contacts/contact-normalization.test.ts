import { describe, expect, it } from "vitest";
import {
  isLikelyDuplicateContact,
  normalizeContactEmail,
  normalizeContactName,
  normalizeContactNameKey,
  normalizeContactPhone,
  normalizeContactProfileUrl,
} from "./contact-normalization";

describe("contact normalization", () => {
  it("normalizes whitespace without overwriting cultural name formats", () => {
    expect(normalizeContactName("  Nur Aisyah   binti Ahmad  ")).toBe(
      "Nur Aisyah binti Ahmad",
    );
    expect(normalizeContactNameKey("José A/L Muthu")).toBe("jose a l muthu");
  });

  it("normalizes public emails to lowercase", () => {
    expect(normalizeContactEmail("  SALES@Example.MY ")).toBe("sales@example.my");
  });

  it("reuses Malaysian phone normalization for phone and WhatsApp values", () => {
    expect(normalizeContactPhone("+60 12-345 6789")).toBe("60123456789");
    expect(normalizeContactPhone("012 345 6789")).toBe("60123456789");
    expect(normalizeContactPhone("0060-12-3456789")).toBe("60123456789");
  });

  it("normalizes public profile URLs", () => {
    expect(
      normalizeContactProfileUrl(" HTTPS://WWW.LinkedIn.com/in/Nur-Aisyah/?trk=public "),
    ).toBe("https://www.linkedin.com/in/nur-aisyah");
  });
});

describe("contact duplicate safety", () => {
  it("flags matching work or personal email", () => {
    expect(
      isLikelyDuplicateContact(
        { fullName: "Aisyah", workEmail: "AISYAH@example.my" },
        { fullName: "Different display", personalEmail: "aisyah@example.my" },
      ),
    ).toBe(true);
  });

  it("flags matching LinkedIn profiles", () => {
    expect(
      isLikelyDuplicateContact(
        { linkedinUrl: "https://linkedin.com/in/nur-aisyah/" },
        { linkedinUrl: "HTTPS://LINKEDIN.COM/in/nur-aisyah" },
      ),
    ).toBe(true);
  });

  it("flags the same normalized name within the same company", () => {
    expect(
      isLikelyDuplicateContact(
        { companyId: "company-a", fullName: "Nur  Aisyah" },
        { companyId: "company-a", fullName: " nur aisyah " },
      ),
    ).toBe(true);
  });

  it("does not flag a shared name at different companies", () => {
    expect(
      isLikelyDuplicateContact(
        { companyId: "company-a", fullName: "Alex Lee" },
        { companyId: "company-b", fullName: "Alex Lee" },
      ),
    ).toBe(false);
  });

  it("does not treat a shared company main phone as sufficient evidence", () => {
    expect(
      isLikelyDuplicateContact(
        {
          companyId: "company-a",
          fullName: "Aisyah Ahmad",
          publicPhone: "04-555 0100",
        },
        {
          companyId: "company-a",
          fullName: "Daniel Tan",
          publicPhone: "04-555 0100",
        },
      ),
    ).toBe(false);
  });
});
