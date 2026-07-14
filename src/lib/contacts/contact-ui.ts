import type { Contact, ContactActor } from "./contact.types";

export function contactDisplayName(contact: Contact): string {
  return (
    contact.fullName ??
    contact.workEmail ??
    contact.mobilePhone ??
    contact.whatsappPhone ??
    "Unnamed contact"
  );
}

export function isContactManagement(actor: ContactActor): boolean {
  return actor.role === "ceo_admin" || actor.role === "sales_manager";
}

export function canEditContact(contact: Contact, actor: ContactActor): boolean {
  return (
    isContactManagement(actor) ||
    contact.createdBy === actor.userId ||
    contact.assignedTo === actor.userId
  );
}

export function canArchiveContact(actor: ContactActor): boolean {
  return isContactManagement(actor);
}
