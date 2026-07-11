import { Icons } from "@/components/icons";

type StatePanelProps = {
  title: string;
  description: string;
  action?: string;
};

export function EmptyState({ title, description, action }: StatePanelProps) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 grid size-11 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 shadow-sm">
          <Icons.search className="size-5" />
        </div>
        <h3 className="font-bold text-zinc-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        {action && (
          <button className="mt-5 rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white" type="button">
            {action}
          </button>
        )}
      </div>
    </div>
  );
}
