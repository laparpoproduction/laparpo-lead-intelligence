import Link from "next/link";
import type { OpportunityDetail } from "@/lib/opportunities/opportunity.types";
import {
  formatOpportunityMyr,
  opportunityServiceLabel,
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
  opportunity,
}: {
  opportunity: OpportunityDetail;
}) {
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
