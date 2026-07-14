import Link from "next/link";
import { ContactDeleteDialog } from "./contact-delete-dialog";
import { ContactPagination } from "./contact-pagination";
import type { ContactQueryState } from "@/lib/contacts/contact-query";
import { canArchiveContact, canEditContact, contactDisplayName } from "@/lib/contacts/contact-ui";
import type {
  Contact,
  ContactActor,
  ContactStatus,
  PaginatedContacts,
} from "@/lib/contacts/contact.types";

const statusLabels: Record<ContactStatus, string> = {
  discovered: "Discovered",
  verified: "Verified",
  contacted: "Contacted",
  qualified: "Qualified",
  inactive: "Inactive",
  do_not_contact: "Do not contact",
};

const dateFormatter = new Intl.DateTimeFormat("en-MY", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function ContactActions({ contact, actor }: { contact: Contact; actor: ContactActor }) {
  const displayName = contactDisplayName(contact);
  return (
    <div className="flex items-center justify-end gap-2">
      {canEditContact(contact, actor) ? (
        <Link
          className="inline-flex min-h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          href={`/contacts/${contact.id}/edit`}
        >
          Edit
        </Link>
      ) : (
        <span className="rounded-lg px-2 text-xs font-semibold text-zinc-400">Read only</span>
      )}
      {canArchiveContact(actor) ? (
        <ContactDeleteDialog contactId={contact.id} contactName={displayName} />
      ) : null}
    </div>
  );
}

function DetailsLink({ contact }: { contact: Contact }) {
  const name = contactDisplayName(contact);
  return (
    <Link
      aria-label={`View ${name} details`}
      className="absolute inset-0 z-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#e5222a]"
      href={`/contacts/${contact.id}`}
    >
      <span className="sr-only">View {name} details</span>
    </Link>
  );
}

function Assignment({ contact, actor }: { contact: Contact; actor: ContactActor }) {
  if (!contact.assignedTo) return <>Unassigned</>;
  if (contact.assignedTo === actor.userId) return <>Assigned to you</>;
  return <>Assigned</>;
}

function CompanyIndicator({ contact }: { contact: Contact }) {
  if (!contact.companyId) return <>Independent</>;
  return (
    <span title={contact.companyId}>
      Linked · <span className="font-mono">{contact.companyId.slice(0, 8)}…</span>
    </span>
  );
}

export function ContactList({
  contacts,
  actor,
  pagination,
  query,
}: {
  contacts: Contact[];
  actor: ContactActor;
  pagination: Pick<
    PaginatedContacts,
    "page" | "pageSize" | "total" | "totalPages"
  >;
  query: ContactQueryState;
}) {
  return (
    <section
      aria-label="Contacts list"
      className="space-y-3"
      data-page={pagination.page}
      data-page-size={pagination.pageSize}
      data-total={pagination.total}
      data-total-pages={pagination.totalPages}
    >
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1080px] border-collapse text-left">
            <caption className="sr-only">Active contacts in the Laparpo CRM</caption>
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-[0.08em] text-zinc-500">
                <th className="px-5 py-3.5 font-bold" scope="col">Contact</th>
                <th className="px-4 py-3.5 font-bold" scope="col">Company</th>
                <th className="px-4 py-3.5 font-bold" scope="col">Public contact</th>
                <th className="px-4 py-3.5 font-bold" scope="col">Status</th>
                <th className="px-4 py-3.5 font-bold" scope="col">Assignment</th>
                <th className="px-4 py-3.5 font-bold" scope="col">Created</th>
                <th className="px-5 py-3.5 text-right font-bold" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {contacts.map((contact) => {
                const name = contactDisplayName(contact);
                const phone = contact.mobilePhone ?? contact.whatsappPhone ?? contact.publicPhone;
                return (
                  <tr className="relative transition hover:bg-zinc-50/70" key={contact.id}>
                    <td className="px-5 py-4">
                      <DetailsLink contact={contact} />
                      <p className="font-bold text-zinc-950">{name}</p>
                      <p className="mt-1 max-w-xs truncate text-xs text-zinc-500">{contact.jobTitle ?? "Job title not provided"}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-600"><CompanyIndicator contact={contact} /></td>
                    <td className="px-4 py-4 text-sm text-zinc-600">
                      <p>{contact.workEmail ?? "—"}</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{phone ?? "No phone listed"}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                        {statusLabels[contact.contactStatus]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-zinc-600"><Assignment actor={actor} contact={contact} /></td>
                    <td className="px-4 py-4 text-sm text-zinc-600">
                      <time dateTime={contact.createdAt}>{dateFormatter.format(new Date(contact.createdAt))}</time>
                    </td>
                    <td className="relative z-10 px-5 py-4"><ContactActions actor={actor} contact={contact} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul aria-label="Contacts" className="divide-y divide-zinc-100 md:hidden">
          {contacts.map((contact) => {
            const name = contactDisplayName(contact);
            const phone = contact.mobilePhone ?? contact.whatsappPhone ?? contact.publicPhone;
            return (
              <li className="relative p-5" key={contact.id}>
                <DetailsLink contact={contact} />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-zinc-950">{name}</p>
                    <p className="mt-1 truncate text-xs text-zinc-500">{contact.jobTitle ?? "Job title not provided"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                    {statusLabels[contact.contactStatus]}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-zinc-400">Company</dt><dd className="mt-1 text-zinc-700"><CompanyIndicator contact={contact} /></dd></div>
                  <div><dt className="text-xs text-zinc-400">Assignment</dt><dd className="mt-1 text-zinc-700"><Assignment actor={actor} contact={contact} /></dd></div>
                  <div className="col-span-2"><dt className="text-xs text-zinc-400">Public contact</dt><dd className="mt-1 break-all text-zinc-700">{contact.workEmail ?? phone ?? "—"}</dd></div>
                  <div><dt className="text-xs text-zinc-400">Created</dt><dd className="mt-1 text-zinc-700">{dateFormatter.format(new Date(contact.createdAt))}</dd></div>
                </dl>
                <div className="relative z-10 mt-5 border-t border-zinc-100 pt-4"><ContactActions actor={actor} contact={contact} /></div>
              </li>
            );
          })}
        </ul>
      </div>
      <ContactPagination {...pagination} query={query} />
    </section>
  );
}
