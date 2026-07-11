import { describe, expect, it } from "vitest";
import { calculateLeadScore, getLeadPriority } from "./score";

describe("lead scoring", () => {
  it("weights verified public signals by confidence", () => {
    expect(
      calculateLeadScore([
        { type: "influencer_campaign", confidence: 1 },
        { type: "active_social_content", confidence: 0.5 },
        { type: "verified_contact", confidence: 1 },
      ]),
    ).toBe(51);
  });

  it("uses only the strongest duplicate signal", () => {
    expect(
      calculateLeadScore([
        { type: "new_branch", confidence: 0.5 },
        { type: "new_branch", confidence: 0.9 },
      ]),
    ).toBe(18);
  });

  it("maps scores to stable sales priorities", () => {
    expect(getLeadPriority(34)).toBe("low");
    expect(getLeadPriority(35)).toBe("medium");
    expect(getLeadPriority(65)).toBe("high");
  });
});
