import { describe, expect, it } from "vitest";
import {
  buildCompanyFingerprint,
  isLikelyDuplicateCompany,
  normalizeCompanyName,
  normalizePublicPhone,
  normalizeWebsiteDomain,
} from "./duplicate";

describe("company duplicate protection", () => {
  it("normalises company names and Malaysian legal suffixes", () => {
    expect(normalizeCompanyName("  Maju & Selera Sdn. Bhd. ")).toBe(
      "maju and selera",
    );
    expect(normalizeCompanyName("MAJU AND SELERA")).toBe("maju and selera");
  });

  it("normalises website domains", () => {
    expect(normalizeWebsiteDomain("https://www.Example.com/path?q=1")).toBe(
      "example.com",
    );
    expect(normalizeWebsiteDomain("example.com")).toBe("example.com");
    expect(normalizeWebsiteDomain("not a valid domain")).toBe("");
  });

  it("normalises Malaysian phone numbers", () => {
    expect(normalizePublicPhone("+60 12-345 6789")).toBe("60123456789");
    expect(normalizePublicPhone("0060 12-345 6789")).toBe("60123456789");
    expect(normalizePublicPhone("012-345 6789")).toBe("60123456789");
  });

  it("builds a stable fingerprint from formatting variations", () => {
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

  it("flags the same name and website domain", () => {
    expect(
      isLikelyDuplicateCompany(
        { companyName: "Kopi Utara", websiteUrl: "https://kopiutara.my" },
        { companyName: "Kopi Utara Sdn Bhd", websiteUrl: "www.kopiutara.my/menu" },
      ),
    ).toBe(true);
  });

  it("flags the same name and Malaysian phone", () => {
    expect(
      isLikelyDuplicateCompany(
        { companyName: "Kopi Utara", publicPhone: "+60 17-111 2233" },
        { companyName: "Kopi Utara", publicPhone: "017-1112233" },
      ),
    ).toBe(true);
  });

  it("flags the same name and complete city-state location", () => {
    expect(
      isLikelyDuplicateCompany(
        { companyName: "Kopi Utara", city: "Butterworth", state: "Penang" },
        { companyName: "Kopi Utara", city: "Butterworth", state: "PENANG" },
      ),
    ).toBe(true);
  });

  it("does not flag a matching name without corroborating evidence", () => {
    expect(
      isLikelyDuplicateCompany(
        { companyName: "Kopi Utara", state: "Penang" },
        { companyName: "Kopi Utara", state: "Penang" },
      ),
    ).toBe(false);
    expect(
      isLikelyDuplicateCompany(
        { companyName: "Kopi Utara" },
        { companyName: "Kopi Utara" },
      ),
    ).toBe(false);
  });
});
