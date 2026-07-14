import { redirect } from "next/navigation";
import { ContactEmptyState } from "@/components/contacts/contact-empty-state";
import { ContactFilteredEmptyState } from "@/components/contacts/contact-filtered-empty-state";
import { ContactList } from "@/components/contacts/contact-list";
import { ContactListToolbar } from "@/components/contacts/contact-list-toolbar";
import { ContactPageHeader } from "@/components/contacts/contact-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  buildContactsHref,
  hasContactFilters,
  isCanonicalContactQuery,
  parseContactQueryState,
  toContactListOptions,
  type ContactSearchParams,
} from "@/lib/contacts/contact-query";
import { createContactMutationContext } from "@/lib/contacts/contact.server";
import type { ContactActor } from "@/lib/contacts/contact.types";
import { CONTACTS_DEFAULT_PAGE_SIZE } from "@/lib/contacts/contact.validation";

type ContactsPageProps = {
  searchParams: Promise<ContactSearchParams>;
};

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const rawSearchParams = await searchParams;
  const query = parseContactQueryState(rawSearchParams);
  if (!isCanonicalContactQuery(rawSearchParams, query)) {
    redirect(buildContactsHref(query));
  }

  const dashboardUser = await requireDashboardUser();
  const result = dashboardUser.demoMode
    ? {
        items: [],
        page: 1,
        pageSize: CONTACTS_DEFAULT_PAGE_SIZE,
        total: 0,
        totalPages: 0,
        actor: {
          userId: "00000000-0000-4000-8000-000000000000",
          role: dashboardUser.role,
          isActive: true,
        } satisfies ContactActor,
      }
    : await (async () => {
        const { actor, service } = await createContactMutationContext();
        const contacts = await service.search(
          toContactListOptions(query, CONTACTS_DEFAULT_PAGE_SIZE),
          actor,
        );
        return { ...contacts, actor };
      })();

  const lastValidPage = Math.max(result.totalPages, 1);
  if (query.page > lastValidPage) {
    redirect(buildContactsHref(query, { page: lastValidPage }));
  }

  return (
    <section>
      <ContactPageHeader
        actionHref="/contacts/new"
        actionLabel="Add contact"
        description="Public business contacts with source evidence, role-aware ownership and duplicate-safe workflows."
        title="Contacts"
      />
      <ContactListToolbar query={query} />
      {result.items.length === 0 ? (
        hasContactFilters(query) ? (
          <ContactFilteredEmptyState query={query} />
        ) : (
          <ContactEmptyState />
        )
      ) : (
        <ContactList
          actor={result.actor}
          contacts={result.items}
          pagination={{
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          }}
          query={query}
        />
      )}
    </section>
  );
}
