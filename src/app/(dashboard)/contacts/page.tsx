import { ContactEmptyState } from "@/components/contacts/contact-empty-state";
import { ContactList } from "@/components/contacts/contact-list";
import { ContactPageHeader } from "@/components/contacts/contact-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import { createContactMutationContext } from "@/lib/contacts/contact.server";
import type { ContactActor } from "@/lib/contacts/contact.types";
import { CONTACTS_DEFAULT_PAGE_SIZE } from "@/lib/contacts/contact.validation";

export default async function ContactsPage() {
  const dashboardUser = await requireDashboardUser();
  const result = dashboardUser.demoMode
    ? {
        items: [],
        pageSize: CONTACTS_DEFAULT_PAGE_SIZE,
        total: 0,
        actor: {
          userId: "00000000-0000-4000-8000-000000000000",
          role: dashboardUser.role,
          isActive: true,
        } satisfies ContactActor,
      }
    : await (async () => {
        const { actor, service } = await createContactMutationContext();
        const contacts = await service.list(
          {
            page: 1,
            pageSize: CONTACTS_DEFAULT_PAGE_SIZE,
            sortBy: "createdAt",
            sortDirection: "desc",
          },
          actor,
        );
        return { ...contacts, actor };
      })();

  return (
    <section>
      <ContactPageHeader
        actionHref="/contacts/new"
        actionLabel="Add contact"
        description="Public business contacts with source evidence, role-aware ownership and duplicate-safe workflows."
        title="Contacts"
      />
      {result.items.length === 0 ? (
        <ContactEmptyState />
      ) : (
        <ContactList
          actor={result.actor}
          contacts={result.items}
          pageSize={result.pageSize}
          total={result.total}
        />
      )}
    </section>
  );
}
