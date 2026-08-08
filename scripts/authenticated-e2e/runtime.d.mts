export const AUTHENTICATED_E2E_DIRECTORY: string;
export const SUPABASE_STATUS_FILE: string;
export const AUTHENTICATED_E2E_RUNTIME_FILE: string;
export const AI_STUB_CALLS_FILE: string;

export function parseSupabaseStatusEnv(
  contents: string,
): Record<string, string>;
export function validateSupabaseStatus(status: Record<string, string>): {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  databaseUrl: string;
};
export function readAuthenticatedE2ERuntime(): Promise<{
  databaseUrl: string;
  managementUsers: Array<{ id: string; email: string; password: string }>;
  representativeUsers: Array<{ id: string; email: string; password: string }>;
  pipelineFixtures: Record<
    "overdue" | "unassigned" | "won" | "archived",
    { leadId: string; opportunityId: string; title: string }
  >;
  representativePipelineFixtures: Array<{
    categories: Record<
      | "overdue"
      | "unassigned"
      | "quotation"
      | "negotiation"
      | "probabilityOverride"
      | "missingClose",
      { leadId: string; opportunityId: string; title: string }
    >;
    won: { leadId: string; opportunityId: string; title: string };
    lost: { leadId: string; opportunityId: string; title: string };
    inaccessible: { leadId: string; opportunityId: string; title: string };
    expectedStageCounts: Record<
      "new" | "discussion" | "quotation_sent" | "negotiation" | "won" | "lost",
      number
    >;
  }>;
}>;
