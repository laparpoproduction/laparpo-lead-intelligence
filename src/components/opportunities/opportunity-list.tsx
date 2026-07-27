import Link from "next/link";
import { OpportunityPagination } from "./opportunity-pagination";
import type { OpportunityQueryState } from "@/lib/opportunities/opportunity-query";
import type {
  OpportunityListItem,
  PaginatedOpportunities,
} from "@/lib/opportunities/opportunity.types";
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

function DateValue({
  value,
  empty,
}: {
  value: string | null;
  empty: string;
}) {
  return value ? (
    <time dateTime={value}>{dateTime.format(new Date(value))}</time>
  ) : (
    <span className="text-zinc-400">{empty}</span>
  );
}

function KindBadge({ opportunity }: { opportunity: OpportunityListItem }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        opportunity.isConversion
          ? "bg-red-50 text-red-700"
          : "bg-zinc-100 text-zinc-700"
      }`}
    >
      {opportunity.isConversion
        ? "Conversion Opportunity"
        : "Ordinary Opportunity"}
    </span>
  );
}

function Identity({ opportunity }: { opportunity: OpportunityListItem }) {
  return (
    <div className="min-w-0">
      <Link
        className="break-words font-bold text-zinc-950 underline-offset-4 hover:text-[#c91920] hover:underline"
        href={`/leads/${opportunity.leadId}`}
      >
        {opportunity.leadTitle}
      </Link>
      {opportunity.companyId && opportunity.companyName ? (
        <Link
          className="mt-1 block break-words text-xs text-zinc-500 hover:underline"
          href={`/companies/${opportunity.companyId}`}
        >
          {opportunity.companyName}
        </Link>
      ) : (
        <p className="mt-1 text-xs text-zinc-400">No client recorded</p>
      )}
      <p className="mt-1 break-all font-mono text-[11px] text-zinc-400">
        <Link
          className="inline-flex min-h-10 items-center break-all underline-offset-4 hover:text-[#c91920] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5222a] focus-visible:ring-offset-2"
          href={`/opportunities/${opportunity.id}`}
        >
          {opportunity.id}
        </Link>
      </p>
    </div>
  );
}

function Metadata({ opportunity }: { opportunity: OpportunityListItem }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-xs font-semibold text-zinc-400">Quotation</dt>
        <dd className="mt-1 break-all text-zinc-700">
          {opportunity.quotationNumber ?? "Not recorded"}
        </dd>
        {opportunity.quotationSentAt ? (
          <dd className="mt-1 text-xs text-zinc-500">
            Sent <DateValue empty="" value={opportunity.quotationSentAt} />
          </dd>
        ) : null}
      </div>
      <div>
        <dt className="text-xs font-semibold text-zinc-400">Meeting</dt>
        <dd className="mt-1 text-zinc-700">
          <DateValue empty="Not scheduled" value={opportunity.meetingAt} />
        </dd>
      </div>
      <div>
        <dt className="text-xs font-semibold text-zinc-400">Deposit</dt>
        <dd className="mt-1 text-zinc-700">
          {formatOpportunityMyr(opportunity.depositAmountMyr)}
        </dd>
        {opportunity.depositReceivedAt ? (
          <dd className="mt-1 text-xs text-zinc-500">
            Received{" "}
            <DateValue empty="" value={opportunity.depositReceivedAt} />
          </dd>
        ) : null}
      </div>
    </dl>
  );
}

export function OpportunityList({
  opportunities,
  pagination,
  query,
}: {
  opportunities: OpportunityListItem[];
  pagination: Pick<
    PaginatedOpportunities,
    "page" | "pageSize" | "total" | "totalPages"
  >;
  query: OpportunityQueryState;
}) {
  return (
    <section
      aria-label="Opportunities list"
      className="space-y-3"
      data-page-size={pagination.pageSize}
    >
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1180px] border-collapse text-left">
            <caption className="sr-only">
              Opportunities visible under current Lead access
            </caption>
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs uppercase tracking-[0.08em] text-zinc-500">
                {[
                  "Lead / client",
                  "Kind",
                  "Service",
                  "Estimated value",
                  "Quotation",
                  "Meeting",
                  "Deposit",
                  "Created",
                ].map((label) => (
                  <th className="px-4 py-3.5 font-bold" key={label} scope="col">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {opportunities.map((opportunity) => (
                <tr className="align-top hover:bg-zinc-50/70" key={opportunity.id}>
                  <td className="max-w-72 px-4 py-4">
                    <Identity opportunity={opportunity} />
                  </td>
                  <td className="px-4 py-4">
                    <KindBadge opportunity={opportunity} />
                    {opportunity.convertedAt ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        <time dateTime={opportunity.convertedAt}>
                          {date.format(new Date(opportunity.convertedAt))}
                        </time>
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-700">
                    {opportunityServiceLabel(opportunity.service)}
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-zinc-900">
                    {formatOpportunityMyr(opportunity.estimatedValueMyr)}
                  </td>
                  <td className="max-w-44 break-all px-4 py-4 text-sm text-zinc-600">
                    {opportunity.quotationNumber ?? "Not recorded"}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-600">
                    <DateValue
                      empty="Not scheduled"
                      value={opportunity.meetingAt}
                    />
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-600">
                    {formatOpportunityMyr(opportunity.depositAmountMyr)}
                  </td>
                  <td className="px-4 py-4 text-sm text-zinc-600">
                    <time dateTime={opportunity.createdAt}>
                      {date.format(new Date(opportunity.createdAt))}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="divide-y divide-zinc-100 lg:hidden">
          {opportunities.map((opportunity) => (
            <li className="min-w-0 space-y-4 p-5" key={opportunity.id}>
              <Identity opportunity={opportunity} />
              <div className="flex flex-wrap items-center gap-2">
                <KindBadge opportunity={opportunity} />
                <span className="text-sm font-semibold text-zinc-700">
                  {opportunityServiceLabel(opportunity.service)}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-400">
                  Estimated value
                </p>
                <p className="mt-1 font-bold text-zinc-950">
                  {formatOpportunityMyr(opportunity.estimatedValueMyr)}
                </p>
              </div>
              <Metadata opportunity={opportunity} />
              <p className="text-xs text-zinc-500">
                Created{" "}
                <time dateTime={opportunity.createdAt}>
                  {date.format(new Date(opportunity.createdAt))}
                </time>
              </p>
            </li>
          ))}
        </ul>
      </div>
      <OpportunityPagination {...pagination} query={query} />
    </section>
  );
}
