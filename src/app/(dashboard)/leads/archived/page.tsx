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
import { LEADS_DEFAULT_PAGE_SIZE } from "@/lib/leads/lead-ui";

export default async function ArchivedLeadsPage({
  searchParams,
}: {
  searchParams: Promise<LeadSearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const query = parseLeadQueryState(rawSearchParams);
  if (!isCanonicalLeadQuery(rawSearchParams, query)) {
    redirect(buildLeadsHref(query, {}, true));
  }

  const user = await requireDashboardUser({
    allowedRoles: ["ceo_admin", "sales_manager"],
  });
  if (user.demoMode) {
    return (
      <section>
        <LeadPageHeader
          backHref="/leads"
          description="Management-only soft-deleted Leads available for recovery."
          title="Archived leads"
        />
        <LeadListToolbar archived query={query} />
        {hasLeadFilters(query) ? (
          <LeadFilteredEmptyState archived query={query} />
        ) : (
          <LeadEmptyState archived />
        )}
      </section>
    );
  }

  const { actor, service } = await createLeadMutationContext();
  const result = await service.listArchived(
    toLeadListOptions(query, LEADS_DEFAULT_PAGE_SIZE),
    actor,
  );
  const lastPage = Math.max(result.totalPages, 1);
  if (query.page > lastPage) {
    redirect(buildLeadsHref(query, { page: lastPage }, true));
  }

  return (
    <section>
      <LeadPageHeader
        backHref="/leads"
        description="Management-only soft-deleted Leads available for recovery."
        title="Archived leads"
      />
      <LeadListToolbar archived query={query} />
      {result.items.length === 0 ? (
        hasLeadFilters(query) ? (
          <LeadFilteredEmptyState archived query={query} />
        ) : (
          <LeadEmptyState archived />
        )
      ) : (
        <LeadList
          actor={actor}
          archived
          leads={result.items}
          pagination={result}
          query={query}
        />
      )}
    </section>
  );
}
