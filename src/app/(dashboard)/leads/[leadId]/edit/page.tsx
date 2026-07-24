import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/leads/lead-form";
import { LeadPageHeader } from "@/components/leads/lead-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import { LeadNotFoundError, LeadPermissionError, LeadValidationError } from "@/lib/leads/lead.service";
import { createLeadMutationContext } from "@/lib/leads/lead.server";
import { canEditLead } from "@/lib/leads/lead-ui";
import type { Lead, LeadActor } from "@/lib/leads/lead.types";

export default async function EditLeadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const user = await requireDashboardUser();
  if (user.demoMode) notFound();
  let lead: Lead;
  let actor: LeadActor;
  try {
    const context = await createLeadMutationContext();
    actor = context.actor;
    lead = await context.service.getById(leadId, actor);
  } catch (error) {
    if (error instanceof LeadValidationError || error instanceof LeadNotFoundError || error instanceof LeadPermissionError) notFound();
    throw error;
  }
  if (!canEditLead(lead, actor)) {
    return <section className="mx-auto max-w-3xl"><LeadPageHeader backHref={`/leads/${lead.id}`} description="Company-derived access is read-only." title="Read-only lead" /><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950" role="alert"><h3 className="font-black">You cannot edit {lead.title}</h3><p className="mt-2 text-sm leading-6">Only management, the creator or the assignee can update this Lead.</p><Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white" href={`/leads/${lead.id}`}>Back to Lead</Link></div></section>;
  }
  return <section className="mx-auto max-w-5xl"><LeadPageHeader backHref={`/leads/${lead.id}`} description="Update pipeline details while preserving server authorization and duplicate safeguards." title={`Edit ${lead.title}`} /><LeadForm actor={actor} lead={lead} mode="edit" /></section>;
}
