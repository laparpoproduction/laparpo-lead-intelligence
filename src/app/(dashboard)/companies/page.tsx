import { CompanyEmptyState } from "@/components/companies/company-empty-state";
import { CompanyList } from "@/components/companies/company-list";
import { CompanyPageHeader } from "@/components/companies/company-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import { COMPANIES_DEFAULT_PAGE_SIZE } from "@/lib/companies/company.constants";
import { createCompanyMutationContext } from "@/lib/companies/company.server";

export default async function CompaniesPage() {
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
        const companies = await service.list(
          {
            page: 1,
            pageSize: COMPANIES_DEFAULT_PAGE_SIZE,
            sortBy: "createdAt",
            sortDirection: "desc",
          },
          actor,
        );
        return {
          ...companies,
          canDelete: actor.role === "ceo_admin" || actor.role === "sales_manager",
        };
      })();

  return (
    <section>
      <CompanyPageHeader
        actionHref="/companies/new"
        actionLabel="Add company"
        description="Verified business profiles with public source provenance and duplicate-safe workflows."
        title="Companies"
      />
      {result.items.length === 0 ? (
        <CompanyEmptyState />
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
        />
      )}
    </section>
  );
}
