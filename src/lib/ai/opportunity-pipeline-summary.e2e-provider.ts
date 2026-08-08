import "server-only";

import { appendFile } from "node:fs/promises";
import path from "node:path";
import { pipelineSummaryProviderInputSchema } from "./opportunity-pipeline-summary.input";
import { derivePipelineSummaryOverviewCode } from "./opportunity-pipeline-summary.projection";
import type {
  PipelineSummaryFocusCode,
  PipelineSummaryProvider,
  PipelineSummaryProviderRequest,
  PipelineSummaryProviderResult,
} from "./opportunity-pipeline-summary.types";

function assertSafeCallsFile(callsFile: string): string {
  const resolved = path.resolve(callsFile);
  const allowedDirectory = path.resolve(process.cwd(), ".tmp/authenticated-e2e");
  if (!resolved.startsWith(`${allowedDirectory}${path.sep}`)) {
    throw new Error("Authenticated E2E AI call counter path is invalid");
  }
  return resolved;
}

function snapshotFromRequest(request: PipelineSummaryProviderRequest) {
  const content = request.input[1].content;
  const startMarker = "<pipeline_snapshot>\n";
  const endMarker = "\n</pipeline_snapshot>";
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start < 0 || end <= start) {
    throw new Error("Authenticated E2E pipeline snapshot is missing");
  }
  return pipelineSummaryProviderInputSchema.parse(
    JSON.parse(content.slice(start + startMarker.length, end)),
  );
}

export class DeterministicE2EPipelineSummaryProvider
  implements PipelineSummaryProvider
{
  private readonly callsFile: string;

  constructor(callsFile: string) {
    this.callsFile = assertSafeCallsFile(callsFile);
  }

  async generate(
    request: PipelineSummaryProviderRequest,
  ): Promise<PipelineSummaryProviderResult> {
    const snapshot = snapshotFromRequest(request);
    const priorities: PipelineSummaryFocusCode[] = [
      "overdue_expected_close",
      "unassigned_active",
      "quotation_follow_up",
      "negotiation_follow_up",
      "missing_expected_close",
      "review_probability_override",
    ];
    const availableCodes = new Set(
      snapshot.opportunities.flatMap((row) => row.attentionCodes),
    );
    const focusAreas = priorities
      .filter((code) => availableCodes.has(code))
      .slice(0, 3)
      .map((code) => ({
        code,
        opportunityIds: snapshot.opportunities
          .filter((row) => row.attentionCodes.includes(code))
          .slice(0, 5)
          .map((row) => row.opportunityId),
      }));
    await appendFile(
      this.callsFile,
      `${JSON.stringify({
        type: "pipeline-summary",
        activeOpportunityCount: snapshot.activeOpportunityCount,
        analyzedCandidateCount: snapshot.analyzedCandidateCount,
        stageCounts: snapshot.stageCounts,
        attentionCodes: [...availableCodes].sort(),
      })}\n`,
      { encoding: "utf8" },
    );
    return {
      output: {
        overviewCode: derivePipelineSummaryOverviewCode(
          snapshot.activeOpportunityCount,
          snapshot.analyzedCandidateCount,
          snapshot.opportunities,
        ),
        focusAreas,
      },
      usage: null,
    };
  }
}
