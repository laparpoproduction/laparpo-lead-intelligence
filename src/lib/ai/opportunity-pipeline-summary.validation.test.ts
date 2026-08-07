import { describe, expect, it } from "vitest";
import { projectOpportunityPipelineSummary } from "./opportunity-pipeline-summary.projection";
import {
  makePipelineSummaryReadModel,
  makePipelineSummaryRow,
  pipelineActorId,
} from "./opportunity-pipeline-summary.test-fixtures";
import {
  InvalidPipelineSummaryOutputError,
  validatePipelineSummaryOutput,
} from "./opportunity-pipeline-summary.validation";

const now = new Date("2026-08-07T12:00:00.000Z");
const overdue = makePipelineSummaryRow(1, {
  expected_close_date: "2026-08-01",
});
const unassigned = makePipelineSummaryRow(2, { owner_id: null });
const projection = projectOpportunityPipelineSummary(
  makePipelineSummaryReadModel([overdue, unassigned]),
  pipelineActorId,
  now,
);

function reject(output: Parameters<typeof validatePipelineSummaryOutput>[1]) {
  expect(() => validatePipelineSummaryOutput(projection, output)).toThrow(
    InvalidPipelineSummaryOutputError,
  );
}

describe("pipeline summary semantic validation", () => {
  it("accepts only accessible UUIDs that satisfy their grounded predicate", () => {
    expect(
      validatePipelineSummaryOutput(projection, {
        overviewCode: "pipeline_requires_attention",
        focusAreas: [
          { code: "overdue_expected_close", opportunityIds: [overdue.id] },
          { code: "unassigned_active", opportunityIds: [unassigned.id] },
        ],
      }),
    ).toBeDefined();
  });

  it("rejects invented, inaccessible, terminal, or wrong-predicate UUIDs", () => {
    for (const opportunityId of [
      "99999999-9999-4999-8999-999999999999",
      "33333333-3333-4333-8333-333333333333",
    ]) {
      reject({
        overviewCode: "pipeline_requires_attention",
        focusAreas: [{ code: "overdue_expected_close", opportunityIds: [opportunityId] }],
      });
    }
    reject({
      overviewCode: "pipeline_requires_attention",
      focusAreas: [
        { code: "overdue_expected_close", opportunityIds: [unassigned.id] },
      ],
    });
  });

  it("rejects duplicate focus codes and duplicate IDs", () => {
    reject({
      overviewCode: "pipeline_requires_attention",
      focusAreas: [
        { code: "overdue_expected_close", opportunityIds: [overdue.id] },
        { code: "overdue_expected_close", opportunityIds: [overdue.id] },
      ],
    });
    reject({
      overviewCode: "pipeline_requires_attention",
      focusAreas: [
        { code: "overdue_expected_close", opportunityIds: [overdue.id, overdue.id] },
      ],
    });
  });

  it("rejects a model-controlled overview classification", () => {
    reject({
      overviewCode: "pipeline_has_actionable_items",
      focusAreas: [],
    });
  });
});
