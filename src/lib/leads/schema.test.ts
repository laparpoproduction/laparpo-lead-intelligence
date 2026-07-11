import { describe, expect, it } from "vitest";
import { publicLeadSchema } from "./schema";

describe("public lead validation", () => {
  it("accepts a sourced public business lead", () => {
    const result = publicLeadSchema.parse({
      companyName: "  Kedai Makan Maju  ",
      category: "fnb",
      publicEmail: "SALES@EXAMPLE.COM",
      sourceUrl: "https://example.com/business/kedai-makan-maju",
      discoveredAt: "2026-07-11T10:00:00.000Z",
      sourceType: "business_directory",
    });

    expect(result.companyName).toBe("Kedai Makan Maju");
    expect(result.publicEmail).toBe("sales@example.com");
    expect(result.state).toBe("Penang");
  });

  it("rejects a lead without a source URL", () => {
    expect(() =>
      publicLeadSchema.parse({
        companyName: "Unsourced Business",
        category: "other",
        discoveredAt: "2026-07-11T10:00:00.000Z",
        sourceType: "manual",
      }),
    ).toThrow();
  });
});
