import { redirect } from "next/navigation";
import { LeadEmptyState } from "@/components/leads/lead-empty-state";
import { LeadList } from "@/components/leads/lead-list";
import { LeadPageHeader } from "@/components/leads/lead-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import { createLeadMutationContext } from "@/lib/leads/lead.server";
import { isLeadManagement, LEADS_DEFAULT_PAGE_SIZE } from "@/lib/leads/lead-ui";
import type { LeadActor } from "@/lib/leads/lead.types";

function pageNumber(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw ?? "1");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const raw = await searchParams;
  const page = pageNumber(raw.page);
  if ((Array.isArray(raw.page) || (raw.page && String(page) !== raw.page)) && raw.page !== undefined) redirect(page === 1 ? "/leads" : `/leads?page=${page}`);

  const user = await requireDashboardUser();
  const result = user.demoMode ? {
    items: [],
    page: 1,
    pageSize: LEADS_DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    actor: { userId: "00000000-0000-4000-8000-000000000000", role: user.role, isActive: true } satisfies LeadActor,
  } : await (async () => {
    const { actor, service } = await createLeadMutationContext();
    const leads = await service.list({ page, pageSize: LEADS_DEFAULT_PAGE_SIZE, sortBy: "updatedAt", sortDirection: "desc" }, actor);
    return { ...leads, actor };
  })();

  const lastPage = Math.max(result.totalPages, 1);
  if (page > lastPage) redirect(lastPage === 1 ? "/leads" : `/leads?page=${lastPage}`);

  return <section><LeadPageHeader actionHref="/leads/new" actionLabel="Add lead" description="Qualification, ownership, commercial value and follow-up across the active pipeline." secondaryHref={isLeadManagement(result.actor) ? "/leads/archived" : undefined} secondaryLabel={isLeadManagement(result.actor) ? "Archived leads" : undefined} title="Leads" />{result.items.length === 0 ? <LeadEmptyState /> : <LeadList actor={result.actor} leads={result.items} pagination={result} />}</section>;
}

