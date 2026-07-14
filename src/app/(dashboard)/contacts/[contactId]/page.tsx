import { notFound } from "next/navigation";
import { ContactDetailsPlaceholder } from "@/components/contacts/contact-details-placeholder";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  ContactNotFoundError,
  ContactPermissionError,
  ContactValidationError,
} from "@/lib/contacts/contact.service";
import { createContactMutationContext } from "@/lib/contacts/contact.server";
import { canArchiveContact, canEditContact } from "@/lib/contacts/contact-ui";
import type { Contact, ContactActor } from "@/lib/contacts/contact.types";

export default async function ContactDetailsPage({
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

  return (
    <ContactDetailsPlaceholder
      canArchive={canArchiveContact(actor)}
      canEdit={canEditContact(contact, actor)}
      contact={contact}
    />
  );
}
