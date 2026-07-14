import Link from "next/link";
import { ContactDeleteDialog } from "./contact-delete-dialog";
import { ContactPageHeader } from "./contact-page-header";
import { contactDisplayName } from "@/lib/contacts/contact-ui";
import type { Contact } from "@/lib/contacts/contact.types";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">{label}</dt>
      <dd className="mt-1.5 break-words font-semibold text-zinc-900">{value || "Not provided"}</dd>
    </div>
  );
}

function ExternalProfile({ href, label }: { href: string | null; label: string }) {
  if (!href) return null;
  return (
    <Link className="text-[#c91920] underline-offset-4 hover:underline" href={href} rel="noreferrer noopener" target="_blank">
      Open {label}
    </Link>
  );
}

export function ContactDetailsPlaceholder({
  contact,
  canEdit,
  canArchive,
}: {
  contact: Contact;
  canEdit: boolean;
  canArchive: boolean;
}) {
  const name = contactDisplayName(contact);
  const assignment = contact.assignedTo ? `Assigned · ${contact.assignedTo}` : "Unassigned";

  return (
    <section className="mx-auto max-w-5xl">
      <ContactPageHeader
        actionHref={canEdit ? `/contacts/${contact.id}/edit` : undefined}
        actionLabel={canEdit ? "Edit contact" : undefined}
        backHref="/contacts"
        description="Protected public-contact summary with source provenance."
        title={name}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#e5222a]">Contact details</p>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <Detail label="Job title" value={contact.jobTitle} />
            <Detail label="Department" value={contact.department} />
            <Detail label="Work email" value={contact.workEmail} />
            <Detail label="Mobile / WhatsApp" value={contact.mobilePhone ?? contact.whatsappPhone} />
            <Detail label="Company" value={contact.companyId ? `Linked · ${contact.companyId}` : "Independent"} />
            <Detail label="Assignment" value={assignment} />
            <Detail label="Status" value={contact.contactStatus.replaceAll("_", " ")} />
            <Detail label="Source type" value={contact.sourceType} />
            <Detail
              label="Source"
              value={<Link className="text-[#c91920] underline-offset-4 hover:underline" href={contact.sourceUrl} rel="noreferrer noopener" target="_blank">Open public source</Link>}
            />
            <Detail label="Discovered" value={<time dateTime={contact.discoveredAt}>{new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(new Date(contact.discoveredAt))}</time>} />
          </dl>

          {contact.linkedinUrl || contact.facebookUrl || contact.instagramUrl ? (
            <div className="mt-6 border-t border-zinc-100 pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Public profiles</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm font-bold">
                <ExternalProfile href={contact.linkedinUrl} label="LinkedIn" />
                <ExternalProfile href={contact.facebookUrl} label="Facebook" />
                <ExternalProfile href={contact.instagramUrl} label="Instagram" />
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
            <p className="text-sm font-black text-zinc-900">Contact workspace ready</p>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Timeline, messaging, Leads and analytics remain outside this task.
            </p>
          </div>
          {!canEdit ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              You can view this Contact through Company access, but editing remains read-only.
            </p>
          ) : null}
          {canArchive ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Management</p>
              <ContactDeleteDialog contactId={contact.id} contactName={name} />
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
