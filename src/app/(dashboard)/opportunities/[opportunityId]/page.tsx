import { notFound } from "next/navigation";
import { OpportunityDetails } from "@/components/opportunities/opportunity-details";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  OpportunityDetailValidationError,
} from "@/lib/opportunities/opportunity.service";
import { createOpportunityContext } from "@/lib/opportunities/opportunity.server";
import type { OpportunityDetail } from "@/lib/opportunities/opportunity.types";

export default async function OpportunityDetailsPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const user = await requireDashboardUser();
  if (user.demoMode) notFound();

  let opportunity: OpportunityDetail | null;
  try {
    const { actor, service } = await createOpportunityContext();
    opportunity = await service.getDetailById(opportunityId, actor);
  } catch (error) {
    if (error instanceof OpportunityDetailValidationError) notFound();
    throw error;
  }
  if (!opportunity) notFound();
  return <OpportunityDetails opportunity={opportunity} />;
}
