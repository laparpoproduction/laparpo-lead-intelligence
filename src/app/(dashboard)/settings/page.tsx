import { ModulePlaceholder } from "@/components/module-placeholder";
import { requireDashboardUser } from "@/lib/auth/session";

export default async function SettingsPage() {
  await requireDashboardUser({ allowedRoles: ["ceo_admin"] });
  return <ModulePlaceholder title="Settings" description="Team access, roles and workspace configuration." emptyTitle="No settings changes required" />;
}
