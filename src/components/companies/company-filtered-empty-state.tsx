import Link from "next/link";
import { Icons } from "@/components/icons";
import {
  clearCompanyFiltersHref,
  type CompanyQueryState,
} from "@/lib/companies/company-query";

export function CompanyFilteredEmptyState({
  query,
}: {
  query: CompanyQueryState;
}) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 shadow-sm">
          <Icons.companies className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-zinc-950">
          No matching companies
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Try a broader search or clear the active filters to see more companies.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
          href={clearCompanyFiltersHref(query)}
        >
          Clear all filters
        </Link>
      </div>
    </div>
  );
}
