import { EmptyState } from "@/components/state-panel";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  emptyTitle: string;
};

export function ModulePlaceholder({
  title,
  description,
  emptyTitle,
}: ModulePlaceholderProps) {
  return (
    <section>
      <p className="text-sm font-medium text-[#e5222a]">Foundation module</p>
      <h2 className="mt-1 text-3xl font-black tracking-[-0.035em] text-zinc-950">{title}</h2>
      <p className="mb-7 mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{description}</p>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <EmptyState
          title={emptyTitle}
          description="The protected route and empty state are ready. Operational workflows will be implemented in the relevant delivery sprint."
        />
      </div>
    </section>
  );
}

