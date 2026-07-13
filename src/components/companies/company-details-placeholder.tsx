import { CompanyPageHeader } from "@/components/companies/company-page-header";
import type { Company, CompanyType } from "@/lib/companies/company.types";

const companyTypeLabels: Record<CompanyType, string> = {
  fnb: "F&B",
  agency: "Agency",
  hotel: "Hotel",
  other: "Other",
};

export function CompanyDetailsPlaceholder({ company }: { company: Company }) {
  const location = [company.city, company.state, company.country]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="mx-auto max-w-5xl">
      <CompanyPageHeader
        actionHref={`/companies/${company.id}/edit`}
        actionLabel="Edit company"
        backHref="/companies"
        description="Verified company profile and protected CRM workspace."
        title={company.displayName}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-[#e5222a]">Company details</p>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Legal name</dt>
              <dd className="mt-1.5 font-semibold text-zinc-900">{company.legalName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Company type</dt>
              <dd className="mt-1.5 font-semibold text-zinc-900">{companyTypeLabels[company.companyType]}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Industry</dt>
              <dd className="mt-1.5 font-semibold text-zinc-900">{company.industry ?? "Not provided"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">Location</dt>
              <dd className="mt-1.5 font-semibold text-zinc-900">{location || "Not provided"}</dd>
            </div>
          </dl>
        </div>

        <aside className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
          <p className="text-sm font-black text-zinc-900">Workspace ready</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Additional company workflows will appear here in their separately scoped tasks.
          </p>
        </aside>
      </div>
    </section>
  );
}
