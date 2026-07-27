import Link from "next/link";
import { OpportunityPipelineManager } from "./opportunity-pipeline-manager";
import type { AppRole } from "@/lib/auth/permissions";
import type {
  OpportunityDetail,
  OpportunityOwnerProfile,
} from "@/lib/opportunities/opportunity.types";
import {
  compactOpportunityId,
  formatOpportunityMyr,
  isOpportunityOverdue,
  opportunityLossReasonLabel,
  opportunityServiceLabel,
  opportunityStageLabel,
} from "@/lib/opportunities/opportunity-ui";

const date = new Intl.DateTimeFormat("en-MY", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const dateTime = new Intl.DateTimeFormat("en-MY", {
  dateStyle: "medium",
  timeStyle: "short",
});

function TimeValue({
  value,
  empty,
  includeTime = true,
}: {
  value: string | null;
  empty: string;
  includeTime?: boolean;
}) {
  return value ? (
    <time dateTime={value}>
      {(includeTime ? dateTime : date).format(new Date(value))}
    </time>
  ) : (
    <span className="text-zinc-400">{empty}</span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-400">
        {label}
      </dt>
      <dd className="mt-2 break-words text-sm font-semibold text-zinc-800">
        {children}
      </dd>
    </div>
  );
}

const linkClass =
  "inline-flex min-h-11 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5222a] focus-visible:ring-offset-2";

export function OpportunityDetails({
  actorId,
  actorRole,
  canModify,
  opportunity,
  ownerProfiles,
}: {
  actorId: string;
  actorRole: AppRole;
  canModify: boolean;
  opportunity: OpportunityDetail;
  ownerProfiles: OpportunityOwnerProfile[];
}) {
  const owner = ownerProfiles.find(
    (profile) => profile.id === opportunity.ownerId,
  );
  const overdue = isOpportunityOverdue(
    opportunity.expectedCloseDate,
    opportunity.pipelineStage,
  );
  return (
    <article className="min-w-0 space-y-5">
      <header className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-sm font-bold text-[#c91920]">Opportunity</p>
        <div className="mt-2 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
              {opportunity.leadTitle}
            </h1>
            <p className="mt-2 break-all font-mono text-xs text-zinc-500">
              {opportunity.id}
            </p>
          </div>
          <span
            className={`w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
              opportunity.isConversion
                ? "bg-red-50 text-red-700"
                : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {opportunity.isConversion
              ? "Conversion Opportunity"
              : "Ordinary Opportunity"}
          </span>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className={linkClass} href="/opportunities">
            Back to Opportunities
          </Link>
          <Link className={linkClass} href="/opportunities/pipeline">
            Open Pipeline
          </Link>
          <Link className={linkClass} href={`/leads/${opportunity.leadId}`}>
            Open parent Lead
          </Link>
          {opportunity.companyId && opportunity.companyName ? (
            <Link
              className={linkClass}
              href={`/companies/${opportunity.companyId}`}
            >
              Open Company/client
            </Link>
          ) : null}
        </div>
      </header>

      <section
        aria-labelledby="commercial-summary-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <h2
          className="text-lg font-black text-zinc-950"
          id="commercial-summary-heading"
        >
          Commercial summary
        </h2>
        <dl className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Service">
            {opportunityServiceLabel(opportunity.service)}
          </Field>
          <Field label="Estimated value (MYR)">
            {formatOpportunityMyr(opportunity.estimatedValueMyr)}
          </Field>
          <Field label="Opportunity kind">
            {opportunity.isConversion
              ? "Conversion Opportunity"
              : "Ordinary Opportunity"}
          </Field>
          <Field label="Created">
            <TimeValue empty="Not recorded" value={opportunity.createdAt} />
          </Field>
          <Field label="Last updated">
            <TimeValue empty="Not recorded" value={opportunity.updatedAt} />
          </Field>
          <Field label="Client">
            {opportunity.companyName ? (
              <span className="break-words">{opportunity.companyName}</span>
            ) : (
              <span className="text-zinc-400">
                {opportunity.companyId
                  ? "Client information unavailable"
                  : "No client recorded"}
              </span>
            )}
          </Field>
        </dl>
      </section>

      <section
        aria-labelledby="pipeline-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <h2
              className="text-lg font-black text-zinc-950"
              id="pipeline-heading"
            >
              Pipeline
            </h2>
            <dl className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Current stage">
                {opportunityStageLabel(opportunity.pipelineStage)}
              </Field>
              <Field label="Probability">
                {opportunity.probabilityPercent}% —{" "}
                {opportunity.probabilityOverridden
                  ? "Manual override"
                  : "Stage default"}
              </Field>
              <Field label="Owner">
                {opportunity.ownerId
                  ? owner?.fullName ??
                    `Team member ${compactOpportunityId(opportunity.ownerId)}`
                  : "Unassigned"}
              </Field>
              <Field label="Expected close">
                {opportunity.expectedCloseDate ? (
                  <>
                    <TimeValue
                      empty="Not recorded"
                      includeTime={false}
                      value={opportunity.expectedCloseDate}
                    />
                    {overdue ? (
                      <span className="ml-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
                        Overdue
                      </span>
                    ) : null}
                  </>
                ) : (
                  "Not recorded"
                )}
              </Field>
              {opportunity.pipelineStage === "won" ? (
                <Field label="Won date">
                  <TimeValue
                    empty="Not recorded"
                    value={opportunity.wonAt}
                  />
                </Field>
              ) : null}
              {opportunity.pipelineStage === "lost" ? (
                <>
                  <Field label="Lost date">
                    <TimeValue
                      empty="Not recorded"
                      value={opportunity.lostAt}
                    />
                  </Field>
                  <Field label="Lost reason">
                    {opportunity.lostReason
                      ? opportunityLossReasonLabel(opportunity.lostReason)
                      : "Not recorded"}
                  </Field>
                  {opportunity.lostReasonNotes ? (
                    <Field label="Lost notes">
                      <span className="whitespace-pre-wrap">
                        {opportunity.lostReasonNotes}
                      </span>
                    </Field>
                  ) : null}
                </>
              ) : null}
            </dl>
          </div>
          <div className="w-full shrink-0 xl:w-64">
            <OpportunityPipelineManager
              actorId={actorId}
              actorRole={actorRole}
              canModify={canModify}
              opportunity={opportunity}
              ownerProfiles={ownerProfiles}
            />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="conversion-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <h2 className="text-lg font-black text-zinc-950" id="conversion-heading">
          Conversion context
        </h2>
        {opportunity.isConversion ? (
          <dl className="mt-5 grid gap-6 sm:grid-cols-2">
            <Field label="Source">Converted from Lead</Field>
            <Field label="Conversion date">
              <TimeValue
                empty="Not recorded"
                value={opportunity.convertedAt}
              />
            </Field>
          </dl>
        ) : (
          <p className="mt-4 text-sm font-semibold text-zinc-700">
            Ordinary Opportunity
          </p>
        )}
        <p className="mt-5 text-sm leading-6 text-zinc-500">
          Lead Activities remain available on the parent Lead workspace.
        </p>
      </section>

      <section
        aria-labelledby="sales-metadata-heading"
        className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <h2
          className="text-lg font-black text-zinc-950"
          id="sales-metadata-heading"
        >
          Sales metadata
        </h2>
        <dl className="mt-5 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Quotation number">
            <span className="break-all">
              {opportunity.quotationNumber ?? "Not recorded"}
            </span>
          </Field>
          <Field label="Quotation sent">
            <TimeValue
              empty="Not recorded"
              value={opportunity.quotationSentAt}
            />
          </Field>
          <Field label="Meeting">
            <TimeValue empty="Not scheduled" value={opportunity.meetingAt} />
          </Field>
          <Field label="Deposit amount (MYR)">
            {formatOpportunityMyr(opportunity.depositAmountMyr)}
          </Field>
          <Field label="Deposit received">
            <TimeValue
              empty="Not recorded"
              value={opportunity.depositReceivedAt}
            />
          </Field>
        </dl>
      </section>
    </article>
  );
}
