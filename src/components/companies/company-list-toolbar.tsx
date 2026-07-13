"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";
import {
  buildCompaniesHref,
  clearCompanyFiltersHref,
  hasCompanyFilters,
  parseCompanyQueryState,
  type CompanyQueryState,
} from "@/lib/companies/company-query";

type CompanyListToolbarProps = {
  query: CompanyQueryState;
};

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100";

export function CompanyListToolbar({ query }: CompanyListToolbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasFilters = hasCompanyFilters(query);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextQuery = parseCompanyQueryState(
      Object.fromEntries(
        Array.from(formData.entries(), ([key, value]) => [
          key,
          typeof value === "string" ? value : "",
        ]),
      ),
    );
    startTransition(() => {
      router.push(buildCompaniesHref(nextQuery, { page: 1 }));
    });
  }

  return (
    <section
      aria-label="Search and filter companies"
      className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <form className="space-y-4" method="get" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Search companies
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.q}
              name="q"
              placeholder="Name or website domain"
              type="search"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Company type
            </span>
            <select
              className={fieldClassName}
              defaultValue={query.companyType ?? ""}
              name="companyType"
            >
              <option value="">All types</option>
              <option value="fnb">F&amp;B</option>
              <option value="agency">Agency</option>
              <option value="hotel">Hotel</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Industry
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.industry}
              name="industry"
              placeholder="e.g. Hospitality"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              City
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.city}
              name="city"
              placeholder="e.g. George Town"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              State
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.state}
              name="state"
              placeholder="e.g. Penang"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">
                Sort by
              </span>
              <select
                className={fieldClassName}
                defaultValue={query.sortBy}
                name="sortBy"
              >
                <option value="displayName">Display name</option>
                <option value="legalName">Legal name</option>
                <option value="industry">Industry</option>
                <option value="city">City</option>
                <option value="state">State</option>
                <option value="createdAt">Created at</option>
                <option value="updatedAt">Updated at</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-xs font-bold text-zinc-600">
                Direction
              </span>
              <select
                className={fieldClassName}
                defaultValue={query.sortDirection}
                name="sortDirection"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {hasFilters ? (
              <>
                <span className="text-xs font-semibold text-zinc-500">
                  Filters active
                </span>
                <Link
                  className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                  href={clearCompanyFiltersHref(query)}
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
        </div>
      </form>
    </section>
  );
}
