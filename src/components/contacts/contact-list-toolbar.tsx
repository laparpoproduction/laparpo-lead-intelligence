"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useTransition } from "react";
import {
  buildContactsHref,
  clearContactFiltersHref,
  hasContactFilters,
  parseContactQueryState,
  type ContactQueryState,
} from "@/lib/contacts/contact-query";

type ContactListToolbarProps = {
  query: ContactQueryState;
};

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-800 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100";

export function ContactListToolbar({ query }: ContactListToolbarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasFilters = hasContactFilters(query);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextQuery = parseContactQueryState(
      Object.fromEntries(
        Array.from(formData.entries(), ([key, value]) => [
          key,
          typeof value === "string" ? value : "",
        ]),
      ),
    );
    startTransition(() => {
      router.push(buildContactsHref(nextQuery, { page: 1 }));
    });
  }

  return (
    <section
      aria-label="Search and filter contacts"
      className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <form className="space-y-4" method="get" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Search contacts
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.q}
              name="q"
              placeholder="Name, email, phone or LinkedIn"
              type="search"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Contact status
            </span>
            <select
              className={fieldClassName}
              defaultValue={query.contactStatus ?? ""}
              name="contactStatus"
            >
              <option value="">All statuses</option>
              <option value="discovered">Discovered</option>
              <option value="verified">Verified</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="inactive">Inactive</option>
              <option value="do_not_contact">Do not contact</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Primary contact
            </span>
            <select
              className={fieldClassName}
              defaultValue={
                query.isPrimaryContact === undefined
                  ? ""
                  : String(query.isPrimaryContact)
              }
              name="isPrimaryContact"
            >
              <option value="">All contacts</option>
              <option value="true">Primary only</option>
              <option value="false">Non-primary only</option>
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
          <label>
            <span className="mb-1.5 block text-xs font-bold text-zinc-600">
              Creator profile ID
            </span>
            <input
              className={fieldClassName}
              defaultValue={query.createdBy}
              name="createdBy"
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
                <option value="fullName">Full name</option>
                <option value="jobTitle">Job title</option>
                <option value="department">Department</option>
                <option value="contactStatus">Contact status</option>
                <option value="createdAt">Created at</option>
                <option value="updatedAt">Updated at</option>
                <option value="lastVerifiedAt">Last verified at</option>
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
                  Contact filters active
                </span>
                <Link
                  className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
                  href={clearContactFiltersHref(query)}
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
