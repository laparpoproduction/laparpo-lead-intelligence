import { notFound } from "next/navigation";
import { CompanyForm } from "@/components/companies/company-form";
import { CompanyPageHeader } from "@/components/companies/company-page-header";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  CompanyNotFoundError,
  CompanyPermissionError,
} from "@/lib/companies/company.service";
import { createCompanyMutationContext } from "@/lib/companies/company.server";
import type { Company } from "@/lib/companies/company.types";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dashboardUser = await requireDashboardUser();
  if (dashboardUser.demoMode) notFound();

  let company: Company;
  try {
    const { actor, service } = await createCompanyMutationContext();
    company = await service.getById(id, actor);
  } catch (error) {
    if (
      error instanceof CompanyNotFoundError ||
      error instanceof CompanyPermissionError
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <section className="mx-auto max-w-5xl">
      <CompanyPageHeader
        backHref="/companies"
        description="Update public company information while preserving source provenance and duplicate checks."
        title={`Edit ${company.displayName}`}
      />
      <CompanyForm company={company} mode="edit" />
    </section>
  );
}
