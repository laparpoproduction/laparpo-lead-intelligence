import Link from "next/link";
import { Icons } from "@/components/icons";

export function CompanyEmptyState() {
  return (
    <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/70 p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 shadow-sm">
          <Icons.companies className="size-6" />
        </div>
        <h3 className="text-lg font-bold text-zinc-950">No companies yet</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Add the first sourced business profile to start building Laparpo&apos;s CRM.
        </p>
        <Link
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
          href="/companies/new"
        >
          <Icons.plus className="size-4" />
          Add first company
        </Link>
      </div>
    </div>
  );
}
