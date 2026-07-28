import { redirect } from "next/navigation";
import { LeadPageHeader } from "@/components/leads/lead-page-header";
import {
  OpportunityEmptyState,
  OpportunityFilteredEmptyState,
} from "@/components/opportunities/opportunity-empty-state";
import { OpportunityList } from "@/components/opportunities/opportunity-list";
import { OpportunityListToolbar } from "@/components/opportunities/opportunity-list-toolbar";
import { OpportunityWorkspaceNav } from "@/components/opportunities/opportunity-workspace-nav";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  buildOpportunitiesHref,
  hasOpportunityFilters,
  isCanonicalOpportunityQuery,
  parseOpportunityQueryState,
  toOpportunityListOptions,
  type OpportunitySearchParams,
} from "@/lib/opportunities/opportunity-query";
import { createOpportunityContext } from "@/lib/opportunities/opportunity.server";
import { OPPORTUNITIES_DEFAULT_PAGE_SIZE } from "@/lib/opportunities/opportunity-ui";

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<OpportunitySearchParams>;
}) {
  const rawSearchParams = await searchParams;
  const query = parseOpportunityQueryState(rawSearchParams);
  if (!isCanonicalOpportunityQuery(rawSearchParams, query)) {
    redirect(buildOpportunitiesHref(query));
  }

  const user = await requireDashboardUser();
  const result = user.demoMode
    ? {
        items: [],
        page: 1,
        pageSize: OPPORTUNITIES_DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0,
      }
    : await (async () => {
        const { actor, service } = await createOpportunityContext();
        return service.list(
          toOpportunityListOptions(query, OPPORTUNITIES_DEFAULT_PAGE_SIZE),
          actor,
        );
      })();

  const lastPage = Math.max(result.totalPages, 1);
  if (query.page > lastPage) {
    redirect(buildOpportunitiesHref(query, { page: lastPage }));
  }

  return (
    <section>
      <LeadPageHeader
        description="Review commercial Opportunities or open the visual pipeline workspace."
        title="Opportunities"
      />
      <OpportunityWorkspaceNav current="list" />
      <OpportunityListToolbar query={query} />
      {result.items.length === 0 ? (
        hasOpportunityFilters(query) ? (
          <OpportunityFilteredEmptyState query={query} />
        ) : (
          <OpportunityEmptyState />
        )
      ) : (
        <OpportunityList
          opportunities={result.items}
          pagination={result}
          query={query}
        />
      )}
    </section>
  );
}
