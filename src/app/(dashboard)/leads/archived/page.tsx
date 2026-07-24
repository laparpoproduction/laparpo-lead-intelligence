import { redirect } from "next/navigation";
import { LeadEmptyState } from "@/components/leads/lead-empty-state";
import { LeadList } from "@/components/leads/lead-list";
import { LeadPageHeader } from "@/components/leads/lead-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import { createLeadMutationContext } from "@/lib/leads/lead.server";
import { LEADS_DEFAULT_PAGE_SIZE } from "@/lib/leads/lead-ui";

function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
export default async function ArchivedLeadsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const user = await requireDashboardUser({ allowedRoles: ["ceo_admin", "sales_manager"] });
  if (user.demoMode) return <section><LeadPageHeader backHref="/leads" description="Management-only soft-deleted Leads available for recovery." title="Archived leads" /><LeadEmptyState archived /></section>;
  const raw = await searchParams;
  const page = parsePage(raw.page);
  const { actor, service } = await createLeadMutationContext();
  const result = await service.listArchived({ page, pageSize: LEADS_DEFAULT_PAGE_SIZE, sortBy: "updatedAt", sortDirection: "desc" }, actor);
  const lastPage = Math.max(result.totalPages, 1);
  if (page > lastPage) redirect(lastPage === 1 ? "/leads/archived" : `/leads/archived?page=${lastPage}`);
  return <section><LeadPageHeader backHref="/leads" description="Management-only soft-deleted Leads available for recovery." title="Archived leads" />{result.items.length === 0 ? <LeadEmptyState archived /> : <LeadList actor={actor} archived leads={result.items} pagination={result} />}</section>;
}
