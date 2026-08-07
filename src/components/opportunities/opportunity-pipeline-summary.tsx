"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { generateOpportunityPipelineSummaryAction } from "@/app/(dashboard)/opportunities/pipeline/summary-action";
import { initialOpportunityPipelineSummaryActionState } from "@/app/(dashboard)/opportunities/pipeline/summary-state";
import {
  formatOpportunityMyr,
  opportunityServiceLabel,
  opportunityStageLabel,
} from "@/lib/opportunities/opportunity-ui";

function SummaryButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e5222a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#c91920] disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Summarizing…" : "Summarize pipeline"}
      {pending ? (
        <span className="sr-only" role="status">
          Opportunity pipeline summary is generating
        </span>
      ) : null}
    </button>
  );
}

export function OpportunityPipelineSummary() {
  const [state, formAction] = useActionState(
    generateOpportunityPipelineSummaryAction,
    initialOpportunityPipelineSummaryActionState,
  );
  const success = state.status === "success";
  const summary = state.summary;

  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#e5222a]">
        AI-assisted priority
      </p>
      <h2 className="mt-2 text-lg font-black text-zinc-950">
        AI Pipeline Summary
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
        Opt in to prioritize grounded facts from Opportunities you can already
        access. Company names, Lead titles, Contacts and notes are not sent to
        the AI provider.
      </p>
      <p className="mt-2 text-sm font-semibold text-zinc-800">
        Advisory and read-only — no CRM data will be changed.
      </p>

      <form action={formAction} className="mt-5">
        <SummaryButton />
      </form>

      {state.status !== "idle" ? (
        <div
          aria-live="polite"
          className={`mt-5 rounded-xl border p-4 text-sm ${
            success
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
          role={success ? "status" : "alert"}
        >
          <p className="font-bold">
            {success ? "Suggested review focus ready" : "Summary unavailable"}
          </p>
          <p className="mt-1">{state.message}</p>
        </div>
      ) : null}

      {summary ? (
        <div
          aria-label="AI pipeline summary result"
          className="mt-6 border-t border-zinc-200 pt-6"
          role="region"
        >
          <h3 className="text-base font-black text-zinc-950">Overview</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            {summary.overview}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Analyzed {summary.analyzedCandidateCount} of {summary.activeOpportunityCount}{" "}
            accessible active Opportunities; maximum {summary.candidateLimit} detailed
            candidates per summary.
          </p>

          {summary.focusAreas.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {summary.focusAreas.map((focus) => (
                <section
                  className="min-w-0 rounded-xl border border-zinc-200 p-4"
                  key={focus.code}
                >
                  <h4 className="text-sm font-black text-zinc-950">
                    {focus.heading}
                  </h4>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">
                    {focus.reason}
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-zinc-800">
                    {focus.action}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {focus.opportunities.map((opportunity) => (
                      <li
                        className="min-w-0 rounded-lg bg-zinc-50 p-3"
                        key={opportunity.opportunityId}
                      >
                        <Link
                          className="inline-flex min-h-11 items-center break-words text-sm font-bold text-[#b3131a] underline decoration-red-200 underline-offset-4 hover:text-[#7f0e13]"
                          href={`/opportunities/${opportunity.opportunityId}`}
                        >
                          {opportunity.label}
                        </Link>
                        <p className="mt-1 break-all text-[11px] text-zinc-500">
                          {opportunity.opportunityId}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-zinc-600">
                          {opportunityServiceLabel(opportunity.service)} ·{" "}
                          {opportunityStageLabel(opportunity.pipelineStage)} ·{" "}
                          {formatOpportunityMyr(opportunity.estimatedValueMyr)}
                          {opportunity.expectedCloseDate
                            ? ` · Expected close ${opportunity.expectedCloseDate}`
                            : " · Expected close not recorded"}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-zinc-600">
              No grounded review category was selected from the analyzed snapshot.
            </p>
          )}

          <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-xs leading-5 text-zinc-600">
            <p className="font-bold text-zinc-800">Advisory only</p>
            <p className="mt-1">
              Values are based only on currently accessible CRM metadata.
              Opportunity stages, owners, probabilities and recorded values were not
              modified. Probability remains persisted CRM metadata, not an AI prediction.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
