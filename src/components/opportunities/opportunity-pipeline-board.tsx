import Link from "next/link";
import { OpportunityPipelineManager } from "./opportunity-pipeline-manager";
import type { AppRole } from "@/lib/auth/permissions";
import {
  buildOpportunitiesHref,
  type OpportunityQueryState,
} from "@/lib/opportunities/opportunity-query";
import type {
  OpportunityOwnerProfile,
  OpportunityPipelineBoard as PipelineBoard,
  OpportunityPipelineCard,
  OpportunityPipelineStage,
} from "@/lib/opportunities/opportunity.types";
import type { OpportunityPipelineQueryState } from "@/lib/opportunities/opportunity-pipeline-query";
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

function ownerLabel(
  ownerId: string | null,
  ownerProfiles: OpportunityOwnerProfile[],
): string {
  if (!ownerId) return "Unassigned";
  const owner = ownerProfiles.find((profile) => profile.id === ownerId);
  return owner?.fullName ?? `Team member ${compactOpportunityId(ownerId)}`;
}

function DateValue({
  value,
  includeTime = false,
}: {
  value: string;
  includeTime?: boolean;
}) {
  return (
    <time dateTime={value}>
      {(includeTime ? dateTime : date).format(new Date(value))}
    </time>
  );
}

function CardMetadata({
  opportunity,
  ownerProfiles,
}: {
  opportunity: OpportunityPipelineCard;
  ownerProfiles: OpportunityOwnerProfile[];
}) {
  const overdue = isOpportunityOverdue(
    opportunity.expectedCloseDate,
    opportunity.pipelineStage,
  );
  return (
    <dl className="grid gap-3 text-xs">
      <div>
        <dt className="font-bold text-zinc-400">Service</dt>
        <dd className="mt-1 break-words font-semibold text-zinc-700">
          {opportunityServiceLabel(opportunity.service)}
        </dd>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <dt className="font-bold text-zinc-400">Estimated value</dt>
          <dd className="mt-1 break-words text-sm font-black text-zinc-950">
            {formatOpportunityMyr(opportunity.estimatedValueMyr)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="font-bold text-zinc-400">Probability</dt>
          <dd className="mt-1 font-black text-zinc-950">
            {opportunity.probabilityPercent}%
          </dd>
          <dd className="mt-0.5 font-semibold text-zinc-500">
            {opportunity.probabilityOverridden
              ? "Manual override"
              : "Stage default"}
          </dd>
        </div>
      </div>
      <div>
        <dt className="font-bold text-zinc-400">Owner</dt>
        <dd className="mt-1 break-words font-semibold text-zinc-700">
          {ownerLabel(opportunity.ownerId, ownerProfiles)}
        </dd>
      </div>
      <div>
        <dt className="font-bold text-zinc-400">Expected close</dt>
        <dd
          className={`mt-1 font-semibold ${
            overdue ? "text-amber-900" : "text-zinc-700"
          }`}
        >
          {opportunity.expectedCloseDate ? (
            <>
              <DateValue value={opportunity.expectedCloseDate} />
              {overdue ? (
                <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5">
                  Overdue
                </span>
              ) : null}
            </>
          ) : (
            "Not recorded"
          )}
        </dd>
      </div>
      {opportunity.pipelineStage === "won" && opportunity.wonAt ? (
        <div>
          <dt className="font-bold text-emerald-700">Won date</dt>
          <dd className="mt-1 font-semibold text-zinc-700">
            <DateValue includeTime value={opportunity.wonAt} />
          </dd>
        </div>
      ) : null}
      {opportunity.pipelineStage === "lost" && opportunity.lostAt ? (
        <>
          <div>
            <dt className="font-bold text-red-700">Lost date</dt>
            <dd className="mt-1 font-semibold text-zinc-700">
              <DateValue includeTime value={opportunity.lostAt} />
            </dd>
          </div>
          {opportunity.lostReason ? (
            <div>
              <dt className="font-bold text-red-700">Lost reason</dt>
              <dd className="mt-1 font-semibold text-zinc-700">
                {opportunityLossReasonLabel(opportunity.lostReason)}
              </dd>
            </div>
          ) : null}
          {opportunity.lostReasonNotes ? (
            <div>
              <dt className="font-bold text-red-700">Lost notes</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words font-semibold text-zinc-700">
                {opportunity.lostReasonNotes}
              </dd>
            </div>
          ) : null}
        </>
      ) : null}
    </dl>
  );
}

function OpportunityCard({
  actorId,
  actorRole,
  opportunity,
  ownerProfiles,
}: {
  actorId: string;
  actorRole: AppRole;
  opportunity: OpportunityPipelineCard;
  ownerProfiles: OpportunityOwnerProfile[];
}) {
  return (
    <article
      className="min-w-0 space-y-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
      data-opportunity-id={opportunity.id}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            aria-label={`Open ${opportunity.leadTitle}`}
            className="block break-words text-sm font-black leading-5 text-zinc-950 underline-offset-4 hover:text-[#c91920] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5222a]"
            href={`/opportunities/${opportunity.id}`}
          >
            {opportunity.leadTitle}
          </Link>
          <p
            className="mt-1 break-all font-mono text-[11px] text-zinc-400"
            title={opportunity.id}
          >
            {compactOpportunityId(opportunity.id)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-bold text-zinc-700">
          {opportunity.isConversion ? "Conversion" : "Ordinary"}
        </span>
      </div>
      <p className="break-words text-sm font-semibold text-zinc-600">
        {opportunity.companyName ??
          (opportunity.companyId
            ? "Client information unavailable"
            : "No client recorded")}
      </p>
      <CardMetadata opportunity={opportunity} ownerProfiles={ownerProfiles} />
      <OpportunityPipelineManager
        actorId={actorId}
        actorRole={actorRole}
        canModify={opportunity.canModify}
        opportunity={opportunity}
        ownerProfiles={ownerProfiles}
      />
    </article>
  );
}

function listHref(
  stage: OpportunityPipelineStage,
  query: OpportunityPipelineQueryState,
): string {
  const listQuery: OpportunityQueryState = {
    q: query.q,
    service: query.service,
    kind: query.kind,
    stage,
    sort: "newest",
    page: 1,
  };
  return buildOpportunitiesHref(listQuery);
}

export function OpportunityPipelineBoard({
  actorId,
  actorRole,
  board,
  query,
}: {
  actorId: string;
  actorRole: AppRole;
  board: PipelineBoard;
  query: OpportunityPipelineQueryState;
}) {
  return (
    <section
      aria-label="Opportunity pipeline board"
      className="-mx-1 overflow-x-auto px-1 pb-4"
      data-mobile-presentation="horizontal-stage-sections"
    >
      <div className="grid min-w-max auto-cols-[minmax(18rem,21rem)] grid-flow-col gap-4">
        {board.columns.map((column) => (
          <section
            aria-labelledby={`pipeline-stage-${column.stage}`}
            className="flex min-h-[26rem] min-w-0 flex-col rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3"
            data-stage={column.stage}
            key={column.stage}
          >
            <header className="flex items-center justify-between gap-3 px-1 pb-3">
              <h2
                className="text-sm font-black text-zinc-950"
                id={`pipeline-stage-${column.stage}`}
              >
                {opportunityStageLabel(column.stage)}
              </h2>
              <span
                aria-label={`${column.total} Opportunities`}
                className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-zinc-700 shadow-sm"
              >
                {column.total}
              </span>
            </header>
            {column.items.length === 0 ? (
              <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-zinc-300 bg-white/70 p-5 text-center">
                <p className="text-sm font-semibold text-zinc-500">
                  No Opportunities in {opportunityStageLabel(column.stage)}.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {column.items.map((opportunity) => (
                  <OpportunityCard
                    actorId={actorId}
                    actorRole={actorRole}
                    key={opportunity.id}
                    opportunity={opportunity}
                    ownerProfiles={board.ownerProfiles}
                  />
                ))}
              </div>
            )}
            {column.total > column.items.length ? (
              <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
                <p className="font-semibold">
                  Showing {column.items.length} of {column.total}.
                </p>
                <Link
                  className="mt-2 inline-flex min-h-11 items-center font-bold text-[#c91920] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5222a]"
                  href={listHref(column.stage, query)}
                >
                  View all {opportunityStageLabel(column.stage)} in List
                </Link>
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </section>
  );
}
