import { BrandMark } from "@/components/brand-mark";
import { EmptyState } from "@/components/state-panel";
import { Icons } from "@/components/icons";

type DashboardShellProps = {
  userName: string;
  demoMode?: boolean;
};

const navigation = [
  { label: "Overview", icon: Icons.dashboard, active: true },
  { label: "Leads", icon: Icons.leads },
  { label: "Sales pipeline", icon: Icons.pipeline },
  { label: "Activity", icon: Icons.activity },
];

const metrics = [
  { label: "Qualified leads", value: "0", trend: "Ready for discovery" },
  { label: "Follow-ups due", value: "0", trend: "Nothing overdue" },
  { label: "Meetings", value: "0", trend: "This month" },
  { label: "Deposit value", value: "RM0", trend: "This month" },
];

export function DashboardShell({ userName, demoMode = false }: DashboardShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b border-zinc-200 bg-white/90 backdrop-blur lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-5 lg:h-20 lg:px-6">
          <BrandMark />
          <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-red-700 lg:hidden">
            Sprint 1
          </span>
        </div>
        <nav aria-label="Primary navigation" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:px-4 lg:pb-0">
          {navigation.map(({ label, icon: Icon, active }) => (
            <a
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                active ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
              href="#"
              key={label}
            >
              <Icon />
              {label}
            </a>
          ))}
        </nav>
        <div className="mx-4 mt-8 hidden rounded-2xl border border-red-100 bg-red-50 p-4 lg:block">
          <div className="mb-3 grid size-8 place-items-center rounded-lg bg-white text-[#e5222a] shadow-sm">
            <Icons.spark />
          </div>
          <p className="text-xs font-bold text-zinc-900">Built to win deposits</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">Every lead needs a source, signal and clear next action.</p>
        </div>
      </aside>

      <main className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white/70 px-5 backdrop-blur lg:h-20 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">Saturday, 11 July</p>
            <h1 className="text-base font-bold tracking-tight text-zinc-950">Sales overview</h1>
          </div>
          <div className="flex items-center gap-3">
            {demoMode && (
              <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 sm:inline-flex">
                Setup preview
              </span>
            )}
            <div className="grid size-9 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white" title={userName}>
              {userName.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-5 lg:p-8">
          <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#e5222a]">Good morning, {userName}</p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-zinc-950 sm:text-3xl">Turn signals into conversations.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">Prioritise public business leads, keep follow-ups visible and move qualified prospects towards meetings and deposits.</p>
            </div>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#e5222a] px-4 text-sm font-bold text-white shadow-[0_8px_22px_rgba(229,34,42,.22)] transition hover:bg-[#c71920]" type="button">
              <Icons.plus /> Add lead
            </button>
          </section>

          <section aria-label="Sales metrics" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.02)]" key={metric.label}>
                <p className="text-xs font-semibold text-zinc-500">{metric.label}</p>
                <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-zinc-950">{metric.value}</p>
                <p className="mt-2 text-xs text-zinc-400">{metric.trend}</p>
              </article>
            ))}
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_.8fr]">
            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.02)] sm:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-zinc-950">Priority leads</h3>
                  <p className="mt-1 text-xs text-zinc-500">High-intent prospects that need an action.</p>
                </div>
                <a className="flex items-center gap-1 text-xs font-bold text-zinc-600" href="#">View all <Icons.arrow /></a>
              </div>
              <EmptyState title="No qualified leads yet" description="Lead discovery and import arrive in the next sprint. Every record will include its public source and discovery date." action="Prepare first lead" />
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.02)] sm:p-6">
              <h3 className="font-bold text-zinc-950">Pipeline health</h3>
              <p className="mt-1 text-xs text-zinc-500">Prospects by current sales stage.</p>
              <div className="mt-7 space-y-5">
                {["New", "Contacted", "Meeting", "Quotation", "Deposit"].map((stage, index) => (
                  <div key={stage}>
                    <div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-zinc-600">{stage}</span><span className="text-zinc-400">0</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-[#e5222a]" style={{ width: index === 0 ? "6%" : "0%" }} /></div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}
