import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireDashboardUser } from "@/lib/auth/session";

export default async function CampaignsPage() {
  await requireDashboardUser({ allowedRoles: ["ceo_admin", "sales_manager"] });
  return <ModulePlaceholder title="Campaigns" description="Campaign context for management and production planning." emptyTitle="No campaigns yet" />;
}

