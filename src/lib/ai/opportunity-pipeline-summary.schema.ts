import { z } from "zod";
import {
  pipelineSummaryFocusCodeValues,
  pipelineSummaryOverviewCodeValues,
} from "./opportunity-pipeline-summary.types";

export const PIPELINE_SUMMARY_OUTPUT_BOUNDS = {
  focusAreas: 3,
  opportunityIdsPerFocus: 5,
} as const;

const reservedJsonKeys = new Set(["__proto__", "constructor", "prototype"]);

export class UnsafePipelineSummaryStructureError extends Error {
  constructor() {
    super("Opportunity pipeline summary contains unsafe JSON structure");
    this.name = "UnsafePipelineSummaryStructureError";
  }
}

export function assertSafePipelineSummaryJsonStructure(value: unknown): void {
  const visited = new Set<object>();

  function visit(current: unknown): void {
    if (current === null || typeof current !== "object") return;
    if (visited.has(current)) throw new UnsafePipelineSummaryStructureError();
    visited.add(current);

    const prototype = Object.getPrototypeOf(current);
    if (
      (Array.isArray(current) && prototype !== Array.prototype) ||
      (!Array.isArray(current) && prototype !== Object.prototype)
    ) {
      throw new UnsafePipelineSummaryStructureError();
    }
    if (Object.getOwnPropertySymbols(current).length > 0) {
      throw new UnsafePipelineSummaryStructureError();
    }

    for (const key of Object.getOwnPropertyNames(current)) {
      if (reservedJsonKeys.has(key)) {
        throw new UnsafePipelineSummaryStructureError();
      }
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || !("value" in descriptor)) {
        throw new UnsafePipelineSummaryStructureError();
      }
      visit(descriptor.value);
    }
  }

  visit(value);
}

export function parseRawPipelineSummaryJson(raw: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new UnsafePipelineSummaryStructureError();
  }
  assertSafePipelineSummaryJsonStructure(parsed);
  return parsed;
}

export const pipelineSummarySchema = z
  .object({
    overviewCode: z.enum(pipelineSummaryOverviewCodeValues),
    focusAreas: z
      .array(
        z
          .object({
            code: z.enum(pipelineSummaryFocusCodeValues),
            opportunityIds: z
              .array(z.uuid())
              .min(1)
              .max(PIPELINE_SUMMARY_OUTPUT_BOUNDS.opportunityIdsPerFocus),
          })
          .strict(),
      )
      .max(PIPELINE_SUMMARY_OUTPUT_BOUNDS.focusAreas),
  })
  .strict();
