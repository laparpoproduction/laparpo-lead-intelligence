// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { generateCompanyIntelligenceAction } from "@/app/(dashboard)/companies/intelligence-actions";
import { companyId } from "@/lib/companies/company.test-fixtures";
import { validCompanyIntelligence } from "@/lib/ai/company-intelligence.test-fixtures";
import { CompanyIntelligence } from "./company-intelligence";

vi.mock("@/app/(dashboard)/companies/intelligence-actions", () => ({
  generateCompanyIntelligenceAction: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(generateCompanyIntelligenceAction).mockResolvedValue({
    status: "idle",
  });
});

afterEach(() => cleanup());

describe("Company intelligence UI", () => {
  it("requires an intentional request and clearly labels the non-binding read-only result", async () => {
    vi.mocked(generateCompanyIntelligenceAction).mockResolvedValueOnce({
      status: "success",
      message: "AI recommendation generated. No CRM data was changed.",
      intelligence: validCompanyIntelligence,
    });
    render(<CompanyIntelligence companyId={companyId} />);

    expect(screen.getByText("AI-assisted")).toBeDefined();
    expect(
      screen.getByText("Recommendation only — no CRM data will be changed."),
    ).toBeDefined();
    expect(
      screen.queryByRole("region", {
        name: /Company intelligence recommendation/i,
      }),
    ).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Generate AI intelligence" }),
    );

    expect(
      await screen.findByRole("region", {
        name: "Company intelligence recommendation",
      }),
    ).toBeDefined();
    expect(screen.getByRole("heading", { name: "Summary" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Business signals" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Data-quality gaps" })).toBeDefined();
    expect(
      screen.getByRole("heading", { name: "Recommended next steps" }),
    ).toBeDefined();
    expect(screen.getByText("Confidence: Medium")).toBeDefined();
    expect(screen.queryByText("Confidence: High")).toBeNull();
    expect(
      screen.getByText(
        "Confidence is derived from the completeness of the available Company metadata. It is not external verification, sales probability or conversion probability.",
      ),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Phase 1 recommendations use Low or Medium confidence only.",
      ),
    ).toBeDefined();
    expect(document.querySelector('input[name="companyId"]')?.getAttribute("value")).toBe(
      companyId,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText(validCompanyIntelligence.summary)).toBeDefined();
    expect(
      screen.getByText(validCompanyIntelligence.recommendedNextSteps[0]),
    ).toBeDefined();
    expect(screen.getByText(validCompanyIntelligence.summary).className).toContain(
      "break-words",
    );
    for (const item of document.querySelectorAll("li span:last-child")) {
      expect(item.className).toContain("min-w-0");
      expect(item.className).toContain("break-words");
    }
  });

  it("renders Low confidence without any High confidence path", async () => {
    vi.mocked(generateCompanyIntelligenceAction).mockResolvedValueOnce({
      status: "success",
      message: "AI recommendation generated. No CRM data was changed.",
      intelligence: { ...validCompanyIntelligence, confidence: "low" },
    });
    render(<CompanyIntelligence companyId={companyId} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Generate AI intelligence" }),
    );

    expect(await screen.findByText("Confidence: Low")).toBeDefined();
    expect(screen.queryByText("Confidence: High")).toBeNull();
  });

  it("renders a safe visible error without raw provider details", async () => {
    vi.mocked(generateCompanyIntelligenceAction).mockResolvedValueOnce({
      status: "provider_unavailable",
      message: "Company intelligence is temporarily unavailable.",
    });
    render(<CompanyIntelligence companyId={companyId} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Generate AI intelligence" }),
    );

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(
      screen.getByText("Company intelligence is temporarily unavailable."),
    ).toBeDefined();
  });
});
