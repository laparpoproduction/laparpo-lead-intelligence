import { OverviewContent } from "@/components/overview-content";
import { requireDashboardUser } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await requireDashboardUser();
  return <OverviewContent userName={user.fullName} />;
}

