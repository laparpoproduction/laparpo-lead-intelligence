import { describe, expect, it } from "vitest";
import {
  buildLeadFingerprint,
  isLikelyDuplicateLead,
  normalizeLeadCurrency,
  normalizeLeadKey,
  normalizeLeadSourceUrl,
  normalizeLeadText,
} from "./lead-normalization";

const companyA = "11111111-1111-4111-8111-111111111111";
const companyB = "22222222-2222-4222-8222-222222222222";

describe("Lead normalization and duplicate safety", () => {
  it("normalizes display text without destroying capitalization", () => {
    expect(normalizeLeadText("  KFC   Ramadan Campaign  ")).toBe(
      "KFC Ramadan Campaign",
    );
    expect(normalizeLeadKey(" KFC & Ramadan Campaign ")).toBe(
      "kfc and ramadan campaign",
    );
    expect(normalizeLeadText("  ")).toBeNull();
  });

  it("normalizes ISO-style currency and rejects malformed codes", () => {
    expect(normalizeLeadCurrency(" myr ")).toBe("MYR");
    expect(normalizeLeadCurrency("usd")).toBe("USD");
    expect(normalizeLeadCurrency("RM")).toBeNull();
  });

  it("normalizes source URLs for stable comparisons", () => {
    expect(
      normalizeLeadSourceUrl(" HTTPS://EXAMPLE.MY/Campaign#contacts "),
    ).toBe("https://example.my/campaign");
  });

  it("builds a stable non-unique signal only with corroborating evidence", () => {
    const input = {
      title: "Ramadan Content Campaign",
      companyId: companyA,
      serviceInterest: "social_media_campaign",
    };
    expect(buildLeadFingerprint(input)).toMatch(/^[a-f0-9]{32}$/);
    expect(buildLeadFingerprint({ ...input, title: "  RAMADAN content campaign " })).toBe(
      buildLeadFingerprint(input),
    );
    expect(buildLeadFingerprint({ title: "Title only" })).toBeNull();
  });

  it("flags the same Company and source campaign", () => {
    expect(
      isLikelyDuplicateLead(
        { title: "Corporate video", companyId: companyA, sourceCampaign: "Q3 Launch" },
        { title: "Different label", companyId: companyA, sourceCampaign: "q3 launch" },
      ),
    ).toBe(true);
  });

  it("does not blindly merge different campaigns at one Company", () => {
    expect(
      isLikelyDuplicateLead(
        {
          title: "Corporate video",
          companyId: companyA,
          serviceInterest: "corporate_video",
          sourceCampaign: "Q3 Launch",
        },
        {
          title: "Corporate video",
          companyId: companyA,
          serviceInterest: "corporate_video",
          sourceCampaign: "Q4 Launch",
        },
      ),
    ).toBe(false);
  });

  it("does not treat the same title at different Companies as exact", () => {
    expect(
      isLikelyDuplicateLead(
        { title: "Food review", companyId: companyA },
        { title: "Food review", companyId: companyB },
      ),
    ).toBe(false);
  });

  it("does not use Company or title alone as sufficient evidence", () => {
    expect(
      isLikelyDuplicateLead(
        { title: "Campaign A", companyId: companyA },
        { title: "Campaign B", companyId: companyA },
      ),
    ).toBe(false);
    expect(
      isLikelyDuplicateLead(
        { title: "Same title" },
        { title: "Same title" },
      ),
    ).toBe(false);
  });
});
