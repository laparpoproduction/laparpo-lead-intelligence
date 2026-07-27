import { describe, expect, it } from "vitest";
import {
  mapLeadConversionRecord,
  mapLeadConversionResult,
  mapOpportunityListRow,
  mapOpportunityRow,
} from "./opportunity.mapper";

const leadId = "11111111-1111-4111-8111-111111111111";
const opportunityId = "22222222-2222-4222-8222-222222222222";

describe("Opportunity mapping", () => {
  it("maps legacy money strings and additive service labels", () => {
    expect(
      mapOpportunityRow({
        id: opportunityId,
        lead_id: leadId,
        service: "event_coverage",
        estimated_value_myr: "3500.00",
        quotation_number: null,
        quotation_sent_at: null,
        meeting_at: null,
        deposit_amount_myr: null,
        deposit_received_at: null,
        created_at: "2026-07-25T00:00:00.000Z",
        updated_at: "2026-07-25T00:00:00.000Z",
      }),
    ).toMatchObject({
      id: opportunityId,
      leadId,
      service: "event_coverage",
      estimatedValueMyr: 3500,
    });
  });

  it("maps the single-row RPC response and rejects malformed responses", () => {
    expect(
      mapLeadConversionResult([
        {
          lead_id: leadId,
          opportunity_id: opportunityId,
          conversion_status: "already_converted",
        },
      ]),
    ).toEqual({
      leadId,
      opportunityId,
      status: "already_converted",
    });
    expect(() => mapLeadConversionResult([])).toThrow();
  });

  it("maps immutable conversion ledger metadata", () => {
    expect(
      mapLeadConversionRecord({
        lead_id: leadId,
        opportunity_id: opportunityId,
        converted_at: "2026-07-27T08:00:00.000Z",
        created_by: leadId,
        created_at: "2026-07-27T08:00:00.000Z",
      }),
    ).toEqual({
      leadId,
      opportunityId,
      convertedAt: "2026-07-27T08:00:00.000Z",
      createdBy: leadId,
      createdAt: "2026-07-27T08:00:00.000Z",
    });
  });

  it("classifies only an exact ledger-backed Opportunity as conversion", () => {
    const base = {
      id: opportunityId,
      lead_id: leadId,
      service: "corporate" as const,
      estimated_value_myr: "8000.00",
      quotation_number: null,
      quotation_sent_at: null,
      meeting_at: null,
      deposit_amount_myr: null,
      deposit_received_at: null,
      created_at: "2026-07-27T08:00:00.000Z",
      updated_at: "2026-07-27T08:00:00.000Z",
      lead_title: "Corporate campaign",
      company_id: null,
      company_name: null,
    };
    expect(
      mapOpportunityListRow({
        ...base,
        conversion_opportunity: true,
        converted_at: "2026-07-27T08:00:00.000Z",
      }),
    ).toMatchObject({
      isConversion: true,
      convertedAt: "2026-07-27T08:00:00.000Z",
    });
    expect(
      mapOpportunityListRow({
        ...base,
        conversion_opportunity: false,
        converted_at: null,
      }),
    ).toMatchObject({ isConversion: false, convertedAt: null });
  });
});
