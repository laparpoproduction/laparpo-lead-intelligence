import Link from "next/link";
import {
  buildContactsHref,
  getContactResultRange,
  type ContactQueryState,
} from "@/lib/contacts/contact-query";
import type { PaginatedContacts } from "@/lib/contacts/contact.types";

type ContactPaginationProps = Pick<
  PaginatedContacts,
  "page" | "pageSize" | "total" | "totalPages"
> & {
  query: ContactQueryState;
};

const enabledLinkClassName =
  "inline-flex min-h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50";
const disabledLinkClassName =
  "inline-flex min-h-11 cursor-not-allowed items-center rounded-xl border border-zinc-100 bg-zinc-50 px-4 text-sm font-bold text-zinc-400";

export function ContactPagination({
  page,
  pageSize,
  total,
  totalPages,
  query,
}: ContactPaginationProps) {
  const range = getContactResultRange(page, pageSize, total);
  const hasPrevious = page > 1;
  const hasNext = totalPages > 0 && page < totalPages;

  return (
    <nav
      aria-label="Contacts pagination"
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm font-medium text-zinc-600">
        Showing {range.first}–{range.last} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {hasPrevious ? (
          <Link
            aria-label="Previous contacts page"
            className={enabledLinkClassName}
            href={buildContactsHref(query, { page: page - 1 })}
          >
            Previous
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Previous contacts page"
            className={disabledLinkClassName}
          >
            Previous
          </span>
        )}
        <span
          aria-current="page"
          className="px-2 text-sm font-bold text-zinc-700"
        >
          Page {page} of {totalPages}
        </span>
        {hasNext ? (
          <Link
            aria-label="Next contacts page"
            className={enabledLinkClassName}
            href={buildContactsHref(query, { page: page + 1 })}
          >
            Next
          </Link>
        ) : (
          <span
            aria-disabled="true"
            aria-label="Next contacts page"
            className={disabledLinkClassName}
          >
            Next
          </span>
        )}
      </div>
    </nav>
  );
}
