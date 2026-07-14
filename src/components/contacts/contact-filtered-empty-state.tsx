import Link from "next/link";
import { Icons } from "@/components/icons";
import {
  clearContactFiltersHref,
  type ContactQueryState,
} from "@/lib/contacts/contact-query";

export function ContactFilteredEmptyState({
  query,
}: {
  query: ContactQueryState;
}) {
  return (
    <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 shadow-sm">
          <Icons.contacts className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-zinc-950">
          No matching contacts
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Try a broader search or clear the active filters to see more accessible contacts.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            className="inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
            href={clearContactFiltersHref(query)}
          >
            Clear all filters
          </Link>
          <Link
            className="inline-flex min-h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50"
            href="/contacts/new"
          >
            Add contact
          </Link>
        </div>
      </div>
    </div>
  );
}
