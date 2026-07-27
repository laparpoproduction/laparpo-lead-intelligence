import Link from "next/link";
import {
  buildOpportunitiesHref,
  getOpportunityResultRange,
  type OpportunityQueryState,
} from "@/lib/opportunities/opportunity-query";
import type { PaginatedOpportunities } from "@/lib/opportunities/opportunity.types";

export function OpportunityPagination({
  page,
  pageSize,
  total,
  totalPages,
  query,
}: Pick<
  PaginatedOpportunities,
  "page" | "pageSize" | "total" | "totalPages"
> & { query: OpportunityQueryState }) {
  const range = getOpportunityResultRange(page, pageSize, total);
  const enabled =
    "inline-flex min-h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500";
  const disabled =
    "inline-flex min-h-11 cursor-not-allowed items-center rounded-xl border border-zinc-100 bg-zinc-50 px-4 text-sm font-bold text-zinc-400";

  return (
    <nav
      aria-label="Opportunities pagination"
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm font-medium text-zinc-600">
        Showing {range.first}–{range.last} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {page > 1 ? (
          <Link
            aria-label="Previous opportunities page"
            className={enabled}
            href={buildOpportunitiesHref(query, { page: page - 1 })}
          >
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={disabled}>
            Previous
          </span>
        )}
        <span aria-current="page" className="px-2 text-sm font-bold text-zinc-700">
          Page {page} of {totalPages}
        </span>
        {totalPages > 0 && page < totalPages ? (
          <Link
            aria-label="Next opportunities page"
            className={enabled}
            href={buildOpportunitiesHref(query, { page: page + 1 })}
          >
            Next
          </Link>
        ) : (
          <span aria-disabled="true" className={disabled}>
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
