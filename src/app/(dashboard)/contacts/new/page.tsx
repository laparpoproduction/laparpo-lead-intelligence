import { ContactForm } from "@/components/contacts/contact-form";
import { ContactPageHeader } from "@/components/contacts/contact-page-header";
import { requireDashboardUser } from "@/lib/auth/session";

export default async function NewContactPage() {
  const user = await requireDashboardUser();
  return (
    <section className="mx-auto max-w-5xl">
      <ContactPageHeader
        backHref="/contacts"
        description="Create a public, sourced Contact. Company linking is optional and cultural names are preserved."
        title="Add contact"
      />
      <ContactForm
        actor={{ userId: user.id, role: user.role, isActive: true }}
        defaultDiscoveredAt={new Date().toISOString()}
        mode="create"
      />
    </section>
  );
}
