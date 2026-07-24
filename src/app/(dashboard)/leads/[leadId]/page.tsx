import { notFound } from "next/navigation";
import { LeadDetails } from "@/components/leads/lead-details";
import { requireDashboardUser } from "@/lib/auth/session";
import { LeadNotFoundError, LeadPermissionError, LeadValidationError } from "@/lib/leads/lead.service";
import { createLeadMutationContext } from "@/lib/leads/lead.server";
import { canArchiveLead, canEditLead } from "@/lib/leads/lead-ui";
import type { Lead, LeadActor } from "@/lib/leads/lead.types";

export default async function LeadDetailsPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const user = await requireDashboardUser();
  if (user.demoMode) notFound();
  let lead: Lead;
  let actor: LeadActor;
  try {
    const context = await createLeadMutationContext();
    actor = context.actor;
    lead = await context.service.getById(leadId, actor);
  } catch (error) {
    if (error instanceof LeadValidationError || error instanceof LeadNotFoundError || error instanceof LeadPermissionError) notFound();
    throw error;
  }
  return <LeadDetails canArchive={canArchiveLead(actor)} canEdit={canEditLead(lead, actor)} lead={lead} />;
}
