import { CompanyForm } from "@/components/companies/company-form";
import { CompanyPageHeader } from "@/components/companies/company-page-header";

export default function NewCompanyPage() {
  return (
    <section className="mx-auto max-w-5xl">
      <CompanyPageHeader
        backHref="/companies"
        description="Create a sourced company profile. Public contact and provenance fields can be completed now or verified later."
        title="Add company"
      />
      <CompanyForm mode="create" />
    </section>
  );
}
