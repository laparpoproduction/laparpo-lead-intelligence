import Link from "next/link";
import { LeadArchiveDialog } from "./lead-archive-dialog";
import { LeadPageHeader } from "./lead-page-header";
import { humanizeLeadValue } from "@/lib/leads/lead-ui";
import type { Lead } from "@/lib/leads/lead.types";

const date = new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" });
const money = (value: number, currency: string) => new Intl.NumberFormat("en-MY", { style: "currency", currency }).format(value);

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">{label}</dt><dd className="mt-1.5 break-words font-semibold text-zinc-900">{value ?? "Not provided"}</dd></div>;
}
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><h3 className="text-sm font-black text-[#e5222a]">{title}</h3><dl className="mt-5 grid gap-5 sm:grid-cols-2">{children}</dl></section>;
}

function Timestamp({ value }: { value: string | null }) {
  return value ? <time dateTime={value}>{dateTime.format(new Date(value))}</time> : null;
}

export function LeadDetails({ lead, canEdit, canArchive }: { lead: Lead; canEdit: boolean; canArchive: boolean }) {
  return (
    <section className="mx-auto max-w-6xl">
      <LeadPageHeader actionHref={canEdit ? `/leads/${lead.id}/edit` : undefined} actionLabel={canEdit ? "Edit lead" : undefined} backHref="/leads" description="Qualification, sales context, provenance and follow-up in one CRM workspace." title={lead.title} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-5">
          <Group title="Lead overview">
            <Detail label="Stage" value={humanizeLeadValue(lead.stage)} />
            <Detail label="Status" value={humanizeLeadValue(lead.leadStatus)} />
            <Detail label="Qualification" value={humanizeLeadValue(lead.qualificationStatus)} />
            <Detail label="Priority" value={humanizeLeadValue(lead.priority)} />
            <Detail label="Service interest" value={lead.serviceInterest ? humanizeLeadValue(lead.serviceInterest) : null} />
            <Detail label="Lead score" value={lead.leadScore} />
          </Group>
          <Group title="Relationships">
            <Detail label="Company" value={lead.companyId ? <Link className="text-[#c91920] hover:underline" href={`/companies/${lead.companyId}`}>{lead.companyId}</Link> : null} />
            <Detail label="Primary contact" value={lead.primaryContactId ? <Link className="text-[#c91920] hover:underline" href={`/contacts/${lead.primaryContactId}`}>{lead.primaryContactId}</Link> : null} />
            <Detail label="Assigned user" value={lead.assignedTo} />
            <Detail label="Created by" value={lead.createdBy} />
          </Group>
          <Group title="Sales information">
            <Detail label="Estimated value" value={lead.estimatedValue === null ? null : money(lead.estimatedValue, lead.currency)} />
            <Detail label="Currency" value={lead.currency} />
            <Detail label="Expected close" value={lead.expectedCloseDate ? <time dateTime={lead.expectedCloseDate}>{date.format(new Date(`${lead.expectedCloseDate}T00:00:00Z`))}</time> : null} />
            <Detail label="Next step" value={lead.nextStep} />
            <Detail label="Business need" value={lead.businessNeed} />
            <Detail label="Budget notes" value={lead.budgetNotes} />
            <Detail label="Timeline notes" value={lead.timelineNotes} />
            <Detail label="Decision-maker notes" value={lead.decisionMakerNotes} />
          </Group>
          <Group title="Follow-up">
            <Detail label="Next follow-up" value={<Timestamp value={lead.nextFollowUpAt} />} />
            <Detail label="Last contacted" value={<Timestamp value={lead.lastContactedAt} />} />
          </Group>
          <Group title="Source and provenance">
            <Detail label="Source type" value={humanizeLeadValue(lead.sourceType)} />
            <Detail label="Source URL" value={lead.sourceUrl ? <Link className="text-[#c91920] hover:underline" href={lead.sourceUrl} rel="noreferrer noopener" target="_blank">Open public source</Link> : null} />
            <Detail label="Source campaign" value={lead.sourceCampaign} />
            <Detail label="Source signal" value={lead.sourceSignalId} />
            <Detail label="Referral" value={lead.referralName} />
            <Detail label="Discovered" value={<Timestamp value={lead.discoveredAt} />} />
            <Detail label="Last verified" value={<Timestamp value={lead.lastVerifiedAt} />} />
          </Group>
          {lead.notes ? <Group title="Notes"><div className="sm:col-span-2"><Detail label="General notes" value={lead.notes} /></div></Group> : null}
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Metadata</p>
            <dl className="mt-4 space-y-4"><Detail label="Created" value={<Timestamp value={lead.createdAt} />} /><Detail label="Updated" value={<Timestamp value={lead.updatedAt} />} /></dl>
          </div>
          {!canEdit ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">This Lead is visible through Company access, but editing requires creator or assignee access.</p> : null}
          {canArchive ? <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"><p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Management</p><LeadArchiveDialog leadId={lead.id} title={lead.title} /></div> : null}
        </aside>
      </div>
    </section>
  );
}
