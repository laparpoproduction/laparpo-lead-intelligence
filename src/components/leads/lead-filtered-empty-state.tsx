import Link from "next/link";
import { Icons } from "@/components/icons";
import {
  clearLeadFiltersHref,
  type LeadQueryState,
} from "@/lib/leads/lead-query";

export function LeadFilteredEmptyState({
  archived = false,
  query,
}: {
  archived?: boolean;
  query: LeadQueryState;
}) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 shadow-sm">
          <Icons.leads className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-zinc-950">
          No matching {archived ? "archived " : ""}leads
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Try a broader search or clear the active filters to see more accessible
          leads.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
            href={clearLeadFiltersHref(query, archived)}
          >
            Clear all filters
          </Link>
          {!archived ? (
            <Link
              className="inline-flex min-h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
              href="/leads/new"
            >
              Add lead
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
