import { describe, expect, it } from "vitest";
import { mapContactCreate, mapContactRow, mapContactUpdate } from "./contact.mapper";
import { contactFixture, contactRowFixture, creatorId } from "./contact.test-fixtures";
import { validateContactCreate } from "./contact.validation";

describe("contact mapper", () => {
  it("maps every database field to the application Contact", () => {
    expect(mapContactRow(contactRowFixture)).toEqual(contactFixture);
  });

  it("preserves nullable database values", () => {
    const row = Object.fromEntries(
      Object.entries(contactRowFixture).map(([key, value]) => [
        key,
        typeof value === "string" && ![
          "id",
          "source_url",
          "source_type",
          "discovered_at",
          "created_at",
          "updated_at",
          "contact_status",
        ].includes(key)
          ? null
          : value,
      ]),
    );
    row.company_id = null;
    row.created_by = null;
    row.assigned_to = null;
    row.is_primary_contact = false;

    const mapped = mapContactRow(row);
    expect(mapped.companyId).toBeNull();
    expect(mapped.fullName).toBeNull();
    expect(mapped.workEmail).toBeNull();
    expect(mapped.fingerprint).toBeNull();
  });

  it("fails clearly when a required database field is malformed", () => {
    expect(() => mapContactRow({ ...contactRowFixture, contact_status: "unknown" })).toThrow();
    expect(() => mapContactRow({ ...contactRowFixture, source_url: undefined })).toThrow();
  });

  it("maps create and partial update payloads without generated fields", () => {
    const created = mapContactCreate(
      validateContactCreate({
        fullName: "  Nur   Aisyah ",
        workEmail: " AISYAH@EXAMPLE.MY ",
        sourceUrl: "https://example.my/team",
        sourceType: " public directory ",
        discoveredAt: "2026-07-10T00:00:00.000Z",
      }),
      creatorId,
    );
    expect(created).toMatchObject({
      full_name: "Nur Aisyah",
      work_email: "aisyah@example.my",
      created_by: creatorId,
      contact_status: "discovered",
    });
    expect(created).not.toHaveProperty("fingerprint");

    expect(mapContactUpdate({ jobTitle: "Director", notes: null })).toEqual({
      job_title: "Director",
      notes: null,
    });
  });
});
