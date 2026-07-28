import { notFound } from "next/navigation";
import { OpportunityDetails } from "@/components/opportunities/opportunity-details";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  OpportunityDetailValidationError,
} from "@/lib/opportunities/opportunity.service";
import { createOpportunityContext } from "@/lib/opportunities/opportunity.server";
import type {
  OpportunityDetail,
  OpportunityOwnerProfile,
} from "@/lib/opportunities/opportunity.types";

export default async function OpportunityDetailsPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  const user = await requireDashboardUser();
  if (user.demoMode) notFound();

  let opportunity: OpportunityDetail | null;
  let actorId = "";
  let actorRole = user.role;
  let canModify = false;
  let ownerProfiles: OpportunityOwnerProfile[] = [];
  try {
    const { actor, service } = await createOpportunityContext();
    actorId = actor.userId;
    actorRole = actor.role;
    opportunity = await service.getDetailById(opportunityId, actor);
    if (opportunity) {
      [canModify, ownerProfiles] = await Promise.all([
        service.canModifyLeadForUi(opportunity.leadId, actor),
        service.listOwnerProfiles(actor),
      ]);
    }
  } catch (error) {
    if (error instanceof OpportunityDetailValidationError) notFound();
    throw error;
  }
  if (!opportunity) notFound();
  return (
    <OpportunityDetails
      actorId={actorId}
      actorRole={actorRole}
      canModify={canModify}
      opportunity={opportunity}
      ownerProfiles={ownerProfiles}
    />
  );
}
