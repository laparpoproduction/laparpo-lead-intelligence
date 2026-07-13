import Link from "next/link";
import { CompanyDeleteDialog } from "@/components/companies/company-delete-dialog";
import type {
  Company,
  CompanyType,
  PaginatedCompanies,
} from "@/lib/companies/company.types";

const companyTypeLabels: Record<CompanyType, string> = {
  fnb: "F&B",
  agency: "Agency",
  hotel: "Hotel",
  other: "Other",
};

const dateFormatter = new Intl.DateTimeFormat("en-MY", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

type CompanyListProps = {
  companies: Company[];
  canDelete: boolean;
  pagination: Pick<
    PaginatedCompanies,
    "page" | "pageSize" | "total" | "totalPages"
  >;
};

function CompanyActions({ company, canDelete }: { company: Company; canDelete: boolean }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        className="inline-flex min-h-9 items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
        href={`/companies/${company.id}/edit`}
      >
        Edit
      </Link>
      {canDelete ? (
        <CompanyDeleteDialog companyId={company.id} companyName={company.displayName} />
      ) : null}
    </div>
  );
}

function CompanyDetailsLink({ company }: { company: Company }) {
  return (
    <Link
      aria-label={`View ${company.displayName} details`}
      className="absolute inset-0 z-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#e5222a]"
      href={`/companies/${company.id}`}
    >
      <span className="sr-only">View {company.displayName} details</span>
    </Link>
  );
}

export function CompanyList({
  companies,
  canDelete,
  pagination,
}: CompanyListProps) {
  return (
    <section
      aria-label="Companies list"
      className="space-y-3"
      data-page={pagination.page}
      data-page-size={pagination.pageSize}
      data-total-pages={pagination.totalPages}
    >
      <p className="text-sm font-medium text-zinc-500">
        Showing {companies.length} of {pagination.total} active companies
      </p>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] border-collapse text-left">
          <caption className="sr-only">Companies in the Laparpo CRM</caption>
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-[0.08em] text-zinc-500">
              <th className="px-5 py-3.5 font-bold" scope="col">Company</th>
              <th className="px-4 py-3.5 font-bold" scope="col">Type</th>
              <th className="px-4 py-3.5 font-bold" scope="col">Industry</th>
              <th className="px-4 py-3.5 font-bold" scope="col">Location</th>
              <th className="px-4 py-3.5 font-bold" scope="col">Created</th>
              <th className="px-5 py-3.5 text-right font-bold" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {companies.map((company) => (
              <tr className="relative transition hover:bg-zinc-50/70" key={company.id}>
                <td className="px-5 py-4">
                  <CompanyDetailsLink company={company} />
                  <p className="font-bold text-zinc-950">{company.displayName}</p>
                  <p className="mt-1 max-w-xs truncate text-xs text-zinc-500">{company.legalName}</p>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                    {companyTypeLabels[company.companyType]}
                  </span>
                </td>
                <td className="px-4 py-4 text-sm text-zinc-600">{company.industry ?? "—"}</td>
                <td className="px-4 py-4 text-sm text-zinc-600">
                  <p>{company.city ?? "—"}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{company.state ?? "—"}</p>
                </td>
                <td className="px-4 py-4 text-sm text-zinc-600">
                  <time dateTime={company.createdAt}>{dateFormatter.format(new Date(company.createdAt))}</time>
                </td>
                <td className="relative z-10 px-5 py-4"><CompanyActions canDelete={canDelete} company={company} /></td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>

        <ul className="divide-y divide-zinc-100 md:hidden" aria-label="Companies">
          {companies.map((company) => (
            <li className="relative p-5" key={company.id}>
              <CompanyDetailsLink company={company} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-zinc-950">{company.displayName}</p>
                  <p className="mt-1 truncate text-xs text-zinc-500">{company.legalName}</p>
                </div>
                <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700">
                  {companyTypeLabels[company.companyType]}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-zinc-400">Industry</dt><dd className="mt-1 text-zinc-700">{company.industry ?? "—"}</dd></div>
                <div><dt className="text-xs text-zinc-400">Location</dt><dd className="mt-1 text-zinc-700">{[company.city, company.state].filter(Boolean).join(", ") || "—"}</dd></div>
                <div><dt className="text-xs text-zinc-400">Created</dt><dd className="mt-1 text-zinc-700">{dateFormatter.format(new Date(company.createdAt))}</dd></div>
              </dl>
              <div className="relative z-10 mt-5 border-t border-zinc-100 pt-4"><CompanyActions canDelete={canDelete} company={company} /></div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
