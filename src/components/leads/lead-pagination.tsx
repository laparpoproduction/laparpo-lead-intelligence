import Link from "next/link";

export function LeadPagination({
  page,
  totalPages,
  archived = false,
}: {
  page: number;
  totalPages: number;
  archived?: boolean;
}) {
  if (totalPages <= 1) return null;
  const base = archived ? "/leads/archived" : "/leads";
  return (
    <nav aria-label="Leads pagination" className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
      <p className="font-semibold text-zinc-500">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        {page > 1 ? <Link className="rounded-lg border border-zinc-200 px-3 py-2 font-bold text-zinc-700" href={`${base}?page=${page - 1}`}>Previous</Link> : null}
        {page < totalPages ? <Link className="rounded-lg border border-zinc-200 px-3 py-2 font-bold text-zinc-700" href={`${base}?page=${page + 1}`}>Next</Link> : null}
      </div>
    </nav>
  );
}
