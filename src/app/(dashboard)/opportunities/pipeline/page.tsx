import { redirect } from "next/navigation";
import { LeadPageHeader } from "@/components/leads/lead-page-header";
import { OpportunityPipelineBoard } from "@/components/opportunities/opportunity-pipeline-board";
import { OpportunityPipelineToolbar } from "@/components/opportunities/opportunity-pipeline-toolbar";
import { OpportunityWorkspaceNav } from "@/components/opportunities/opportunity-workspace-nav";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  buildOpportunityPipelineHref,
  isCanonicalOpportunityPipelineQuery,
  parseOpportunityPipelineQuery,
  toOpportunityPipelineFilters,
} from "@/lib/opportunities/opportunity-pipeline-query";
import { createOpportunityContext } from "@/lib/opportunities/opportunity.server";
import {
  opportunityPipelineStageValues,
  type OpportunityPipelineBoard as PipelineBoard,
} from "@/lib/opportunities/opportunity.types";
import type { OpportunitySearchParams } from "@/lib/opportunities/opportunity-query";

export default async function OpportunityPipelinePage({
  searchParams,
}: {
  searchParams: Promise<OpportunitySearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const query = parseOpportunityPipelineQuery(rawSearchParams);
  if (!isCanonicalOpportunityPipelineQuery(rawSearchParams, query)) {
    redirect(buildOpportunityPipelineHref(query));
  }

  const user = await requireDashboardUser();
  let board: PipelineBoard;
  let actorId = user.id;
  let actorRole = user.role;

  if (user.demoMode) {
    board = {
      columns: opportunityPipelineStageValues.map((stage) => ({
        stage,
        items: [],
        total: 0,
      })),
      ownerProfiles: [],
    };
  } else {
    const { actor, service } = await createOpportunityContext();
    actorId = actor.userId;
    actorRole = actor.role;
    board = await service.listPipeline(
      toOpportunityPipelineFilters(query),
      actor,
    );
  }

  return (
    <section className="min-w-0">
      <LeadPageHeader
        description="Manage active sales movement and review terminal outcomes using the existing authorized Opportunity workflows."
        title="Opportunity Pipeline"
      />
      <OpportunityWorkspaceNav current="pipeline" />
      <OpportunityPipelineToolbar query={query} />
      <p className="mb-4 text-xs font-semibold leading-5 text-zinc-500">
        Each stage shows up to 25 Opportunities with an exact stage count.
        Scroll horizontally to review all six stages on smaller screens.
      </p>
      <OpportunityPipelineBoard
        actorId={actorId}
        actorRole={actorRole}
        board={board}
        query={query}
      />
    </section>
  );
}
