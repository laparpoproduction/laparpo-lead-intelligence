import Link from "next/link";
import { Icons } from "@/components/icons";

export function LeadPageHeader({
  title,
  description,
  backHref,
  actionHref,
  actionLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  description: string;
  backHref?: string;
  actionHref?: string;
  actionLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <header className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {backHref ? (
          <Link className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-zinc-500 transition hover:text-zinc-950" href={backHref}>
            <span aria-hidden="true">←</span> Back to Leads
          </Link>
        ) : (
          <p className="text-sm font-semibold text-[#e5222a]">CRM Core</p>
        )}
        <h2 className="text-3xl font-black tracking-[-0.035em] text-zinc-950 sm:text-4xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {secondaryHref && secondaryLabel ? (
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50" href={secondaryHref}>
            {secondaryLabel}
          </Link>
        ) : null}
        {actionHref && actionLabel ? (
          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#e5222a] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#c91920]" href={actionHref}>
            <Icons.plus className="size-4" />
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </header>
  );
}
