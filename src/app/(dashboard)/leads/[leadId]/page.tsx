import { notFound, redirect } from "next/navigation";
import { LeadActivityTimeline } from "@/components/lead-activities/lead-activity-timeline";
import { LeadDetails } from "@/components/leads/lead-details";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  createLeadActivityMutationContext,
} from "@/lib/lead-activities/lead-activity.server";
import {
  LEAD_ACTIVITY_PAGE_SIZE,
  parseActivityPage,
} from "@/lib/lead-activities/lead-activity-ui";
import type {
  LeadActivityActor,
  PaginatedLeadActivities,
} from "@/lib/lead-activities/lead-activity.types";
import { LeadNotFoundError, LeadPermissionError, LeadValidationError } from "@/lib/leads/lead.service";
import { createLeadMutationContext } from "@/lib/leads/lead.server";
import { canArchiveLead, canEditLead } from "@/lib/leads/lead-ui";
import type { Lead, LeadActor } from "@/lib/leads/lead.types";
import { logger } from "@/lib/logger";

export default async function LeadDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams?: Promise<{ activityPage?: string | string[] }>;
}) {
  const { leadId } = await params;
  const query = (await searchParams) ?? {};
  const activityPage = parseActivityPage(query.activityPage);
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

  let activities: PaginatedLeadActivities | null = null;
  let activityActor: LeadActivityActor = actor;
  let activityLoadError = false;
  try {
    const context = await createLeadActivityMutationContext();
    activityActor = context.actor;
    activities = await context.service.listByLead(
      lead.id,
      {
        page: activityPage,
        pageSize: LEAD_ACTIVITY_PAGE_SIZE,
        sortDirection: "desc",
      },
      activityActor,
    );
  } catch (error) {
    activityLoadError = true;
    logger.error("Lead activity timeline failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      leadId: lead.id,
    });
  }

  if (
    activities &&
    activities.totalPages > 0 &&
    activityPage > activities.totalPages
  ) {
    const suffix =
      activities.totalPages === 1
        ? ""
        : `?activityPage=${activities.totalPages}`;
    redirect(`/leads/${lead.id}${suffix}`);
  }

  const nowIso = new Date().toISOString();
  const canModify = canEditLead(lead, actor);
  return (
    <LeadDetails
      activityTimeline={
        <LeadActivityTimeline
          actor={activityActor}
          canModifyLead={canModify}
          defaultActivityAt={nowIso}
          leadId={lead.id}
          loadError={activityLoadError}
          nowIso={nowIso}
          result={activities}
        />
      }
      canArchive={canArchiveLead(actor)}
      canEdit={canModify}
      lead={lead}
    />
  );
}
