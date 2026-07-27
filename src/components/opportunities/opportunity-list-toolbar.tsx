"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";
import {
  buildOpportunitiesHref,
  clearOpportunityFiltersHref,
  hasOpportunityFilters,
  parseOpportunityQueryState,
  type OpportunityQueryState,
} from "@/lib/opportunities/opportunity-query";
import { opportunityServiceOptions } from "@/lib/opportunities/opportunity-ui";

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100";

export function OpportunityListToolbar({
  query,
}: {
  query: OpportunityQueryState;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasFilters = hasOpportunityFilters(query);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(
      Array.from(new FormData(event.currentTarget).entries(), ([key, value]) => [
        key,
        typeof value === "string" ? value : "",
      ]),
    );
    const nextQuery = parseOpportunityQueryState(values);
    startTransition(() => {
      router.push(buildOpportunitiesHref(nextQuery, { page: 1 }));
    });
  }

  return (
    <section
      aria-label="Search and filter opportunities"
      className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <form className="space-y-4" method="get" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="xl:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Search opportunities
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.q}
              name="q"
              placeholder="Lead, client or Opportunity UUID"
              type="search"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Service
            </span>
            <select
              className={fieldClassName}
              defaultValue={query.service ?? ""}
              name="service"
            >
              <option value="">All services</option>
              {opportunityServiceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Opportunity kind
            </span>
            <select
              className={fieldClassName}
              defaultValue={query.kind}
              name="kind"
            >
              <option value="all">All opportunities</option>
              <option value="conversion">Conversion opportunities</option>
              <option value="ordinary">Ordinary opportunities</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Sort
            </span>
            <select
              className={fieldClassName}
              defaultValue={query.sort}
              name="sort"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="value_desc">Estimated value: high to low</option>
              <option value="value_asc">Estimated value: low to high</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-100 pt-4">
          {hasFilters ? (
            <>
              <span className="text-xs font-semibold text-zinc-500" role="status">
                Opportunity filters active
              </span>
              <Link
                className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                href={clearOpportunityFiltersHref(query)}
              >
                Clear all filters
              </Link>
            </>
          ) : null}
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Updating…" : "Apply filters"}
          </button>
        </div>
      </form>
    </section>
  );
}
