import { redirect } from "next/navigation";
import { LeadEmptyState } from "@/components/leads/lead-empty-state";
import { LeadFilteredEmptyState } from "@/components/leads/lead-filtered-empty-state";
import { LeadList } from "@/components/leads/lead-list";
import { LeadListToolbar } from "@/components/leads/lead-list-toolbar";
import { LeadPageHeader } from "@/components/leads/lead-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  buildLeadsHref,
  hasLeadFilters,
  isCanonicalLeadQuery,
  parseLeadQueryState,
  toLeadListOptions,
  type LeadSearchParams,
} from "@/lib/leads/lead-query";
import { createLeadMutationContext } from "@/lib/leads/lead.server";
import { isLeadManagement, LEADS_DEFAULT_PAGE_SIZE } from "@/lib/leads/lead-ui";
import type { LeadActor } from "@/lib/leads/lead.types";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const query = parseLeadQueryState(rawSearchParams);
  if (!isCanonicalLeadQuery(rawSearchParams, query)) {
    redirect(buildLeadsHref(query));
  }

  const user = await requireDashboardUser();
  const result = user.demoMode
    ? {
        items: [],
        page: 1,
        pageSize: LEADS_DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0,
        actor: {
          userId: "00000000-0000-4000-8000-000000000000",
          role: user.role,
          isActive: true,
        } satisfies LeadActor,
      }
    : await (async () => {
        const { actor, service } = await createLeadMutationContext();
        const leads = await service.search(
          toLeadListOptions(query, LEADS_DEFAULT_PAGE_SIZE),
          actor,
        );
        return { ...leads, actor };
      })();

  const lastPage = Math.max(result.totalPages, 1);
  if (query.page > lastPage) {
    redirect(buildLeadsHref(query, { page: lastPage }));
  }

  return (
    <section>
      <LeadPageHeader
        actionHref="/leads/new"
        actionLabel="Add lead"
        description="Qualification, ownership, commercial value and follow-up across the active pipeline."
        secondaryHref={
          isLeadManagement(result.actor) ? "/leads/archived" : undefined
        }
        secondaryLabel={
          isLeadManagement(result.actor) ? "Archived leads" : undefined
        }
        title="Leads"
      />
      <LeadListToolbar query={query} />
      {result.items.length === 0 ? (
        hasLeadFilters(query) ? (
          <LeadFilteredEmptyState query={query} />
        ) : (
          <LeadEmptyState />
        )
      ) : (
        <LeadList
          actor={result.actor}
          leads={result.items}
          pagination={result}
          query={query}
        />
      )}
    </section>
  );
}
