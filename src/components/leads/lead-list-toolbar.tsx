"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";
import {
  buildLeadsHref,
  clearLeadFiltersHref,
  hasLeadFilters,
  parseLeadQueryState,
  type LeadQueryState,
} from "@/lib/leads/lead-query";
import {
  leadPriorityValues,
  leadQualificationValues,
  leadStageValues,
  leadStatusValues,
} from "@/lib/leads/lead.types";
import { humanizeLeadValue } from "@/lib/leads/lead-ui";

type LeadListToolbarProps = {
  archived?: boolean;
  query: LeadQueryState;
};

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100";

export function LeadListToolbar({
  archived = false,
  query,
}: LeadListToolbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasFilters = hasLeadFilters(query);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextQuery = parseLeadQueryState(
      Object.fromEntries(
        Array.from(formData.entries(), ([key, value]) => [
          key,
          typeof value === "string" ? value : "",
        ]),
      ),
    );
    startTransition(() => {
      router.push(buildLeadsHref(nextQuery, { page: 1 }, archived));
    });
  }

  return (
    <section
      aria-label="Search and filter leads"
      className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <form className="space-y-4" method="get" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="xl:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Search leads
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.q}
              name="q"
              placeholder="Title, service interest or source campaign"
              type="search"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Stage
            </span>
            <select
              className={fieldClassName}
              defaultValue={query.stage ?? ""}
              name="stage"
            >
              <option value="">All stages</option>
              {leadStageValues.map((value) => (
                <option key={value} value={value}>
                  {humanizeLeadValue(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Lead status
            </span>
            <select
              className={fieldClassName}
              defaultValue={query.leadStatus ?? ""}
              name="leadStatus"
            >
              <option value="">All statuses</option>
              {leadStatusValues.map((value) => (
                <option key={value} value={value}>
                  {humanizeLeadValue(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Qualification
            </span>
            <select
              className={fieldClassName}
              defaultValue={query.qualificationStatus ?? ""}
              name="qualificationStatus"
            >
              <option value="">All qualifications</option>
              {leadQualificationValues.map((value) => (
                <option key={value} value={value}>
                  {humanizeLeadValue(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Priority
            </span>
            <select
              className={fieldClassName}
              defaultValue={query.priority ?? ""}
              name="priority"
            >
              <option value="">All priorities</option>
              {leadPriorityValues.map((value) => (
                <option key={value} value={value}>
                  {humanizeLeadValue(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Company ID
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.companyId}
              name="companyId"
              placeholder="Company UUID"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Assigned profile ID
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.assignedTo}
              name="assignedTo"
              placeholder="Profile UUID"
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
                <option value="title">Title</option>
                <option value="stage">Stage</option>
                <option value="leadStatus">Lead status</option>
                <option value="qualificationStatus">Qualification</option>
                <option value="priority">Priority</option>
                <option value="createdAt">Created date</option>
                <option value="updatedAt">Updated date</option>
                <option value="nextFollowUpAt">Next follow-up</option>
                <option value="expectedCloseDate">Expected close date</option>
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
                <span
                  className="text-xs font-semibold text-zinc-500"
                  role="status"
                >
                  Lead filters active
                </span>
                <Link
                  className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                  href={clearLeadFiltersHref(query, archived)}
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
