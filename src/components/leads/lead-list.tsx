import Link from "next/link";
import { LeadArchiveDialog } from "./lead-archive-dialog";
import { LeadPagination } from "./lead-pagination";
import { LeadRestoreButton } from "./lead-restore-button";
import { canArchiveLead, canEditLead, humanizeLeadValue } from "@/lib/leads/lead-ui";
import type { Lead, LeadActor, PaginatedLeads } from "@/lib/leads/lead.types";

const date = new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" });

function compactId(value: string | null, empty: string) {
  return value ? `${value.slice(0, 8)}…` : empty;
}

function Actions({ lead, actor, archived }: { lead: Lead; actor: LeadActor; archived: boolean }) {
  if (archived) return <LeadRestoreButton leadId={lead.id} />;
  return (
    <div className="flex justify-end gap-2">
      {canEditLead(lead, actor) ? <Link className="inline-flex min-h-9 items-center rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-700" href={`/leads/${lead.id}/edit`}>Edit</Link> : <span className="px-2 text-xs font-semibold text-zinc-400">Read only</span>}
      {canArchiveLead(actor) ? <LeadArchiveDialog leadId={lead.id} title={lead.title} /> : null}
    </div>
  );
}

function LeadLink({ lead, archived = false }: { lead: Lead; archived?: boolean }) {
  if (archived) return <span className="font-bold text-zinc-950">{lead.title}</span>;
  return <Link aria-label={`View ${lead.title} details`} className="font-bold text-zinc-950 underline-offset-4 hover:text-[#c91920] hover:underline" href={`/leads/${lead.id}`}>{lead.title}</Link>;
}

export function LeadList({
  leads,
  actor,
  pagination,
  archived = false,
}: {
  leads: Lead[];
  actor: LeadActor;
  pagination: Pick<PaginatedLeads, "page" | "pageSize" | "total" | "totalPages">;
  archived?: boolean;
}) {
  return (
    <section aria-label={archived ? "Archived leads list" : "Leads list"} className="space-y-3" data-page-size={pagination.pageSize}>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1500px] border-collapse text-left">
            <caption className="sr-only">{archived ? "Archived" : "Active"} leads in the Laparpo CRM</caption>
            <thead><tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-[0.08em] text-zinc-500">
              {["Lead", "Company", "Primary contact", "Stage / status", "Qualification", "Priority", "Service", "Assignment", "Follow-up", "Expected close", "Updated", "Actions"].map((label) => <th className={`px-4 py-3.5 font-bold ${label === "Actions" ? "text-right" : ""}`} key={label} scope="col">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {leads.map((lead) => <tr className="align-top hover:bg-zinc-50/70" key={lead.id}>
                <td className="px-4 py-4"><LeadLink archived={archived} lead={lead} /><p className="mt-1 text-xs text-zinc-400">{compactId(lead.id, "")}</p></td>
                <td className="px-4 py-4 text-sm text-zinc-600">{lead.companyId ? <Link className="hover:underline" href={`/companies/${lead.companyId}`}>{compactId(lead.companyId, "")}</Link> : "—"}</td>
                <td className="px-4 py-4 text-sm text-zinc-600">{lead.primaryContactId ? <Link className="hover:underline" href={`/contacts/${lead.primaryContactId}`}>{compactId(lead.primaryContactId, "")}</Link> : "—"}</td>
                <td className="px-4 py-4 text-sm"><p className="font-bold text-zinc-800">{humanizeLeadValue(lead.stage)}</p><p className="mt-1 text-xs text-zinc-500">{humanizeLeadValue(lead.leadStatus)}</p></td>
                <td className="px-4 py-4 text-sm text-zinc-600">{humanizeLeadValue(lead.qualificationStatus)}</td>
                <td className="px-4 py-4"><span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">{humanizeLeadValue(lead.priority)}</span></td>
                <td className="px-4 py-4 text-sm text-zinc-600">{lead.serviceInterest ? humanizeLeadValue(lead.serviceInterest) : "—"}</td>
                <td className="px-4 py-4 text-sm text-zinc-600">{lead.assignedTo === actor.userId ? "You" : compactId(lead.assignedTo, "Unassigned")}</td>
                <td className="px-4 py-4 text-sm text-zinc-600">{lead.nextFollowUpAt ? <time dateTime={lead.nextFollowUpAt}>{dateTime.format(new Date(lead.nextFollowUpAt))}</time> : "—"}</td>
                <td className="px-4 py-4 text-sm text-zinc-600">{lead.expectedCloseDate ? <time dateTime={lead.expectedCloseDate}>{date.format(new Date(`${lead.expectedCloseDate}T00:00:00Z`))}</time> : "—"}</td>
                <td className="px-4 py-4 text-sm text-zinc-600"><time dateTime={lead.updatedAt}>{date.format(new Date(lead.updatedAt))}</time></td>
                <td className="px-4 py-4"><Actions actor={actor} archived={archived} lead={lead} /></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <ul aria-label={archived ? "Archived leads" : "Leads"} className="divide-y divide-zinc-100 md:hidden">
          {leads.map((lead) => <li className="p-5" key={lead.id}>
            <div className="flex items-start justify-between gap-3"><LeadLink archived={archived} lead={lead} /><span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">{humanizeLeadValue(lead.priority)}</span></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-zinc-400">Stage</dt><dd className="mt-1 font-semibold">{humanizeLeadValue(lead.stage)}</dd></div>
              <div><dt className="text-xs text-zinc-400">Status</dt><dd className="mt-1">{humanizeLeadValue(lead.leadStatus)}</dd></div>
              <div><dt className="text-xs text-zinc-400">Company</dt><dd className="mt-1">{compactId(lead.companyId, "—")}</dd></div>
              <div><dt className="text-xs text-zinc-400">Service</dt><dd className="mt-1">{lead.serviceInterest ? humanizeLeadValue(lead.serviceInterest) : "—"}</dd></div>
              <div className="col-span-2"><dt className="text-xs text-zinc-400">Next follow-up</dt><dd className="mt-1">{lead.nextFollowUpAt ? dateTime.format(new Date(lead.nextFollowUpAt)) : "—"}</dd></div>
            </dl>
            <div className="mt-4 border-t border-zinc-100 pt-4"><Actions actor={actor} archived={archived} lead={lead} /></div>
          </li>)}
        </ul>
      </div>
      <LeadPagination archived={archived} page={pagination.page} totalPages={pagination.totalPages} />
    </section>
  );
}
