import { BrandMark } from "@/components/brand-mark";
import { DashboardNav } from "@/components/dashboard-nav";
import { roleLabels, type AppRole } from "@/lib/auth/permissions";

type DashboardShellProps = {
  children: React.ReactNode;
  userName: string;
  role: AppRole;
  demoMode?: boolean;
};

export function DashboardShell({
  children,
  userName,
  role,
  demoMode = false,
}: DashboardShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-zinc-200 bg-white/90 backdrop-blur lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-5 lg:h-20 lg:px-6">
          <BrandMark />
          <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700 lg:hidden">
            Foundation
          </span>
        </div>
        <DashboardNav role={role} />
        <div className="mx-4 mt-8 hidden rounded-2xl border border-red-100 bg-red-50 p-4 lg:block">
          <p className="text-xs font-bold text-zinc-900">Built to win deposits</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">
            Every lead needs a source, signal and clear next action.
          </p>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white/70 px-5 backdrop-blur lg:h-20 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
              Laparpo Production
            </p>
            <h1 className="text-base font-bold tracking-tight text-zinc-950">
              Lead Intelligence
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {demoMode && (
              <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 sm:inline-flex">
                Setup preview
              </span>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-xs font-bold text-zinc-800">{userName}</p>
              <p className="text-[11px] text-zinc-400">{roleLabels[role]}</p>
            </div>
            <div
              className="grid size-9 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white"
              title={`${userName} · ${roleLabels[role]}`}
            >
              {userName.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-5 lg:p-8">{children}</div>
      </main>
    </div>
  );
}

