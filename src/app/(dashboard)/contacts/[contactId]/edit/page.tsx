import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contacts/contact-form";
import { ContactPageHeader } from "@/components/contacts/contact-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  ContactNotFoundError,
  ContactPermissionError,
  ContactValidationError,
} from "@/lib/contacts/contact.service";
import { createContactMutationContext } from "@/lib/contacts/contact.server";
import { canEditContact, contactDisplayName } from "@/lib/contacts/contact-ui";
import type { Contact, ContactActor } from "@/lib/contacts/contact.types";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = await params;
  const user = await requireDashboardUser();
  if (user.demoMode) notFound();

  let contact: Contact;
  let actor: ContactActor;
  try {
    const context = await createContactMutationContext();
    actor = context.actor;
    contact = await context.service.getById(contactId, actor);
  } catch (error) {
    if (
      error instanceof ContactValidationError ||
      error instanceof ContactNotFoundError ||
      error instanceof ContactPermissionError
    ) {
      notFound();
    }
    throw error;
  }

  if (!canEditContact(contact, actor)) {
    return (
      <section className="mx-auto max-w-3xl">
        <ContactPageHeader backHref={`/contacts/${contact.id}`} description="This Contact is visible through Company access, but mutation requires creator or assignee access." title="Read-only contact" />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950" role="alert">
          <h3 className="font-black">You cannot edit {contactDisplayName(contact)}</h3>
          <p className="mt-2 text-sm leading-6">Company-derived access is read-only. Contact the owner or Sales Manager if an update is required.</p>
          <Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white" href={`/contacts/${contact.id}`}>Back to Contact</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl">
      <ContactPageHeader backHref={`/contacts/${contact.id}`} description="Update public Contact details while preserving provenance and duplicate safeguards." title={`Edit ${contactDisplayName(contact)}`} />
      <ContactForm actor={actor} contact={contact} mode="edit" />
    </section>
  );
}
