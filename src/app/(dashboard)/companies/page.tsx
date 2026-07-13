import { CompanyEmptyState } from "@/components/companies/company-empty-state";
import { CompanyList } from "@/components/companies/company-list";
import { CompanyPageHeader } from "@/components/companies/company-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import { createCompanyMutationContext } from "@/lib/companies/company.server";

export default async function CompaniesPage() {
  const dashboardUser = await requireDashboardUser();
  const result = dashboardUser.demoMode
    ? { items: [], total: 0, canDelete: true }
    : await (async () => {
        const { actor, service } = await createCompanyMutationContext();
        const companies = await service.list(
          { page: 1, pageSize: 100, sortBy: "createdAt", sortDirection: "desc" },
          actor,
        );
        return {
          items: companies.items,
          total: companies.total,
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
        <>
          <p className="mb-3 text-sm font-medium text-zinc-500">
            Showing {result.items.length} of {result.total} active companies
          </p>
          <CompanyList canDelete={result.canDelete} companies={result.items} />
        </>
      )}
    </section>
  );
}
