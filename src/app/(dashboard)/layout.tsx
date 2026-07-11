import { DashboardShell } from "@/components/dashboard-shell";
import { requireDashboardUser } from "@/lib/auth/session";

export default async function ProtectedDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireDashboardUser();

  return (
    <DashboardShell
      demoMode={user.demoMode}
      role={user.role}
      userName={user.fullName}
    >
      {children}
    </DashboardShell>
  );
}

