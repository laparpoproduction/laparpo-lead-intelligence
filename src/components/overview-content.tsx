import { EmptyState } from "@/components/state-panel";
import { Icons } from "@/components/icons";

const metrics = [
  { label: "New Leads", value: "0", trend: "Awaiting qualification" },
  { label: "Hot Leads", value: "0", trend: "Score 65 and above" },
  { label: "Follow-ups Due", value: "0", trend: "Nothing overdue" },
  { label: "Meetings", value: "0", trend: "This month" },
  { label: "Quotations", value: "0", trend: "This month" },
  { label: "Deposits", value: "RM0", trend: "This month" },
];

export function OverviewContent({ userName }: { userName: string }) {
  return (
    <>
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[#e5222a]">Good morning, {userName}</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] text-zinc-950 sm:text-3xl">
            Turn signals into conversations.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
            Prioritise public business leads and move qualified prospects towards meetings and deposits.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#e5222a] px-4 text-sm font-bold text-white shadow-[0_8px_22px_rgba(229,34,42,.22)]"
          type="button"
        >
          <Icons.plus /> Add lead
        </button>
      </section>

      <section aria-label="Sales metrics" className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article className="rounded-2xl border border-zinc-200 bg-white p-5" key={metric.label}>
            <p className="text-xs font-semibold text-zinc-500">{metric.label}</p>
            <p className="mt-3 text-3xl font-black tracking-[-0.04em] text-zinc-950">
              {metric.value}
            </p>
            <p className="mt-2 text-xs text-zinc-400">{metric.trend}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h3 className="font-bold text-zinc-950">Priority leads</h3>
        <p className="mb-5 mt-1 text-xs text-zinc-500">High-intent prospects that need an action.</p>
        <EmptyState
          title="No qualified leads yet"
          description="Automated discovery is deliberately outside this sprint. Add only legitimate public business information with a source."
          action="Prepare first lead"
        />
      </section>
    </>
  );
}

