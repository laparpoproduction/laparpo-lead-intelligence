import { describe, expect, it } from "vitest";
import {
  buildCompanyFingerprint,
  isLikelyDuplicateCompany,
  normalizePublicPhone,
  normalizeWebsiteDomain,
} from "./duplicate";

describe("company duplicate protection", () => {
  it("builds the same fingerprint from common Malaysian company variations", () => {
    const first = buildCompanyFingerprint({
      companyName: "Maju Selera Sdn. Bhd.",
      websiteUrl: "https://www.majuselera.my/menu",
      publicPhone: "+60 17-261 3036",
      city: "Seberang Jaya",
      state: "Penang",
      country: "MY",
    });
    const second = buildCompanyFingerprint({
      companyName: "MAJU SELERA SDN BHD",
      websiteUrl: "majuselera.my",
      publicPhone: "017-2613036",
      city: "Seberang  Jaya",
      state: "PENANG",
      country: "my",
    });

    expect(first).toBe(second);
  });

  it("normalises website domains and Malaysian phone numbers", () => {
    expect(normalizeWebsiteDomain("https://www.example.com/path")).toBe("example.com");
    expect(normalizePublicPhone("0060 12-345 6789")).toBe("60123456789");
    expect(normalizePublicPhone("012-345 6789")).toBe("60123456789");
  });

  it("requires the name plus a corroborating business attribute", () => {
    expect(
      isLikelyDuplicateCompany(
        { companyName: "Kopi Utara", city: "Butterworth", state: "Penang" },
        { companyName: "Kopi Utara", city: "Butterworth", state: "Penang" },
      ),
    ).toBe(true);

    expect(
      isLikelyDuplicateCompany(
        { companyName: "Kopi Utara", city: "Butterworth" },
        { companyName: "Kopi Utara", city: "Johor Bahru" },
      ),
    ).toBe(false);
  });
});

