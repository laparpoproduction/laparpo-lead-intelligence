import Link from "next/link";
import {
  clearOpportunityFiltersHref,
  type OpportunityQueryState,
} from "@/lib/opportunities/opportunity-query";

export function OpportunityEmptyState() {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
      <div className="max-w-md">
        <h3 className="font-bold text-zinc-950">No opportunities yet</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Opportunities created through Lead conversion or future authorised
          workflows will appear here.
        </p>
      </div>
    </div>
  );
}

export function OpportunityFilteredEmptyState({
  query,
}: {
  query: OpportunityQueryState;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
      <div className="max-w-md">
        <h3 className="font-bold text-zinc-950">No matching opportunities</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Adjust the search or filters. Access restrictions remain applied to
          every result.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white"
          href={clearOpportunityFiltersHref(query)}
        >
          Clear all filters
        </Link>
      </div>
    </div>
  );
}
