type CompanyRecord = {
  id: string;
  legal_name: string;
  display_name: string;
  company_type: string;
  industry: string | null;
  description: string | null;
  city: string | null;
  state: string | null;
  country: string;
  estimated_branch_count: number | null;
  website_url: string | null;
  source_url: string;
  source_type: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type AuditRecord = {
  id: string;
  occurred_at: string;
  request_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  resource_type: string;
  resource_id: string;
  operation: string;
  application_operation: string | null;
  source: string;
  changed_fields: string[];
  resource_version_before: string | null;
  resource_version_after: string | null;
};

export function readCreatedCompany(displayName: string): Promise<CompanyRecord[]>;
export function readCompanyAudit(companyId: string): Promise<AuditRecord[]>;
export function readCompanyDescendantCounts(
  companyId: string,
): Promise<{ contacts: number; leads: number }>;
export function readAIStubCallCount(): Promise<number>;
export function readPipelineFixtureState(
  opportunityIds: string[],
): Promise<{
  opportunities: Array<Record<string, unknown>>;
  auditCount: number;
}>;
export function readAuditBoundaryPrivileges(): Promise<{
  anon: boolean;
  authenticated: boolean;
  serviceRole: boolean;
}>;
