import { redirect } from "next/navigation";
import { CompanyEmptyState } from "@/components/companies/company-empty-state";
import { CompanyFilteredEmptyState } from "@/components/companies/company-filtered-empty-state";
import { CompanyList } from "@/components/companies/company-list";
import { CompanyListToolbar } from "@/components/companies/company-list-toolbar";
import { CompanyPageHeader } from "@/components/companies/company-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import { COMPANIES_DEFAULT_PAGE_SIZE } from "@/lib/companies/company.constants";
import {
  buildCompaniesHref,
  hasCompanyFilters,
  isCanonicalCompanyQuery,
  parseCompanyQueryState,
  toCompanyListOptions,
  type CompanySearchParams,
} from "@/lib/companies/company-query";
import { createCompanyMutationContext } from "@/lib/companies/company.server";

type CompaniesPageProps = {
  searchParams: Promise<CompanySearchParams>;
};

export default async function CompaniesPage({ searchParams }: CompaniesPageProps) {
  const rawSearchParams = await searchParams;
  const query = parseCompanyQueryState(rawSearchParams);
  if (!isCanonicalCompanyQuery(rawSearchParams, query)) {
    redirect(buildCompaniesHref(query));
  }

  const dashboardUser = await requireDashboardUser();
  const result = dashboardUser.demoMode
    ? {
        items: [],
        page: 1,
        pageSize: COMPANIES_DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0,
        canDelete: true,
      }
    : await (async () => {
        const { actor, service } = await createCompanyMutationContext();
        const companies = await service.search(
          toCompanyListOptions(query, COMPANIES_DEFAULT_PAGE_SIZE),
          actor,
        );
        return {
          ...companies,
          canDelete: actor.role === "ceo_admin" || actor.role === "sales_manager",
        };
      })();

  const lastValidPage = Math.max(result.totalPages, 1);
  if (query.page > lastValidPage) {
    redirect(buildCompaniesHref(query, { page: lastValidPage }));
  }

  return (
    <section>
      <CompanyPageHeader
        actionHref="/companies/new"
        actionLabel="Add company"
        description="Verified business profiles with public source provenance and duplicate-safe workflows."
        title="Companies"
      />
      <CompanyListToolbar query={query} />
      {result.items.length === 0 ? (
        hasCompanyFilters(query) ? (
          <CompanyFilteredEmptyState query={query} />
        ) : (
          <CompanyEmptyState />
        )
      ) : (
        <CompanyList
          canDelete={result.canDelete}
          companies={result.items}
          pagination={{
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          }}
          query={query}
        />
      )}
    </section>
  );
}
