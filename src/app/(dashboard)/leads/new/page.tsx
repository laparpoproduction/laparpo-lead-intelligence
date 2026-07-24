import { LeadForm } from "@/components/leads/lead-form";
import { LeadPageHeader } from "@/components/leads/lead-page-header";
import { requireDashboardUser } from "@/lib/auth/session";

export default async function NewLeadPage() {
  const user = await requireDashboardUser();
  return (
    <section className="mx-auto max-w-5xl">
      <LeadPageHeader backHref="/leads" description="Create a sourced Lead with qualification, ownership and duplicate safeguards." title="Add lead" />
      <LeadForm actor={{ userId: user.id, role: user.role, isActive: true }} defaultDiscoveredAt={new Date().toISOString()} mode="create" />
    </section>
  );
}
