import { notFound } from "next/navigation";
import { ZodError } from "zod";
import { CompanyDetailsPlaceholder } from "@/components/companies/company-details-placeholder";
import { requireDashboardUser } from "@/lib/auth/session";
import {
  CompanyNotFoundError,
  CompanyPermissionError,
} from "@/lib/companies/company.service";
import { createCompanyMutationContext } from "@/lib/companies/company.server";
import type { Company } from "@/lib/companies/company.types";

export default async function CompanyDetailsPage({
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
      error instanceof ZodError ||
      error instanceof CompanyNotFoundError ||
      error instanceof CompanyPermissionError
    ) {
      notFound();
    }
    throw error;
  }

  return <CompanyDetailsPlaceholder company={company} />;
}
