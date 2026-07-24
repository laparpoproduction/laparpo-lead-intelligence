import { notFound, redirect } from "next/navigation";
import { LeadActivityTimeline } from "@/components/lead-activities/lead-activity-timeline";
import { LeadPageHeader } from "@/components/leads/lead-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import { createLeadActivityMutationContext } from "@/lib/lead-activities/lead-activity.server";
import {
  LEAD_ACTIVITY_PAGE_SIZE,
  parseActivityPage,
} from "@/lib/lead-activities/lead-activity-ui";
import { createLeadMutationContext } from "@/lib/leads/lead.server";
import {
  LeadNotFoundError,
  LeadPermissionError,
  LeadValidationError,
} from "@/lib/leads/lead.service";

export default async function ArchivedLeadActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams?: Promise<{ page?: string | string[] }>;
}) {
  const { leadId } = await params;
  const query = (await searchParams) ?? {};
  const page = parseActivityPage(query.page);
  const user = await requireDashboardUser({
    allowedRoles: ["ceo_admin", "sales_manager"],
  });
  if (user.demoMode) {
    return (
      <section className="mx-auto max-w-5xl">
        <LeadPageHeader
          backHref={`/leads/${leadId}`}
          description="Management-only activity history available for recovery."
          title="Archived activities"
        />
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <h2 className="font-black text-zinc-950">No archived activities</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Connect Supabase to inspect archived activity history.
          </p>
        </div>
      </section>
    );
  }

  let title: string;
  try {
    const leadContext = await createLeadMutationContext();
    const lead = await leadContext.service.getById(leadId, leadContext.actor);
    title = lead.title;
  } catch (error) {
    if (
      error instanceof LeadValidationError ||
      error instanceof LeadNotFoundError ||
      error instanceof LeadPermissionError
    ) {
      notFound();
    }
    throw error;
  }

  const context = await createLeadActivityMutationContext();
  const result = await context.service.listArchivedByLead(
    leadId,
    {
      page,
      pageSize: LEAD_ACTIVITY_PAGE_SIZE,
      sortDirection: "desc",
    },
    context.actor,
  );
  if (result.totalPages > 0 && page > result.totalPages) {
    const suffix = result.totalPages === 1 ? "" : `?page=${result.totalPages}`;
    redirect(`/leads/${leadId}/activities/archived${suffix}`);
  }

  const nowIso = new Date().toISOString();
  return (
    <section className="mx-auto max-w-5xl">
      <LeadPageHeader
        backHref={`/leads/${leadId}`}
        description={`Recover soft-deleted activity history for ${title}.`}
        title="Archived activities"
      />
      <LeadActivityTimeline
        actor={context.actor}
        archived
        canModifyLead
        defaultActivityAt={nowIso}
        leadId={leadId}
        nowIso={nowIso}
        result={result}
      />
    </section>
  );
}
