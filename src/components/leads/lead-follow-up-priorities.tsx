"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { generateLeadFollowUpQueueAction } from "@/app/(dashboard)/leads/follow-up-action";
import { initialLeadFollowUpQueueActionState } from "@/app/(dashboard)/leads/follow-up-state";
import { humanizeLeadValue } from "@/lib/leads/lead-ui";

function ReviewButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e5222a] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#c91920] disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Reviewing…" : "Review follow-up priorities"}
      {pending ? (
        <span className="sr-only" role="status">
          Lead Follow-up Queue is generating
        </span>
      ) : null}
    </button>
  );
}

export function LeadFollowUpPriorities() {
  const [state, formAction] = useActionState(
    generateLeadFollowUpQueueAction,
    initialLeadFollowUpQueueActionState,
  );
  const success = state.status === "success";
  const queue = state.queue;

  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#e5222a]">
        Deterministic review
      </p>
      <h2 className="mt-2 text-lg font-black text-zinc-950">
        Lead Follow-up Queue
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
        Review configured follow-up signals from Leads you can already access.
        The queue excludes Leads with Opportunities and does not use Contacts,
        notes, Activities, lead scores or recorded money.
      </p>
      <p className="mt-2 text-sm font-semibold text-zinc-800">
        Read-only and transient — generating the queue does not change CRM data.
      </p>

      <form action={formAction} className="mt-5">
        <ReviewButton />
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
            {success ? "Follow-up review ready" : "Queue unavailable"}
          </p>
          <p className="mt-1">{state.message}</p>
        </div>
      ) : null}

      {queue ? (
        <div
          aria-label="Lead follow-up queue result"
          className="mt-6 border-t border-zinc-200 pt-6"
          role="region"
        >
          <h3 className="text-base font-black text-zinc-950">Overview</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">
            {queue.overviewText}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {queue.eligibleAccessibleLeadCount} accessible eligible Leads;{" "}
            {queue.configuredAttentionLeadCount} have configured attention
            signals.
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            Analyzed {queue.analyzedCandidateCount} of{" "}
            {queue.configuredAttentionLeadCount} accessible Leads with configured
            attention signals; maximum {queue.candidateLimit} detailed candidates
            per review.
          </p>

          {queue.overview === "limited_lead_data" ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
              <p className="font-bold">
                This is a bounded category-aware review and may omit Leads that
                also match configured attention rules.
              </p>
              <p className="mt-1">
                Configured categories are sampled before an oldest-updated
                remaining-capacity fallback.
              </p>
            </div>
          ) : null}

          {queue.groups.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {queue.groups.map((group) => (
                <section
                  className="min-w-0 rounded-xl border border-zinc-200 p-4"
                  key={group.code}
                >
                  <h4 className="text-sm font-black text-zinc-950">
                    {group.heading}
                  </h4>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">
                    {group.reason}
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-zinc-800">
                    {group.action}
                  </p>
                  <ul className="mt-4 space-y-3">
                    {group.leads.map((lead) => (
                      <li
                        className="min-w-0 rounded-lg bg-zinc-50 p-3"
                        key={lead.leadId}
                      >
                        <Link
                          className="inline-flex min-h-11 items-center break-words text-sm font-bold text-[#b3131a] underline decoration-red-200 underline-offset-4 hover:text-[#7f0e13]"
                          href={`/leads/${lead.leadId}`}
                        >
                          {lead.title}
                        </Link>
                        <p className="mt-2 text-xs leading-5 text-zinc-600">
                          {humanizeLeadValue(lead.stage)} · Priority{" "}
                          {humanizeLeadValue(lead.priority)}
                          {lead.serviceInterest
                            ? ` · ${humanizeLeadValue(lead.serviceInterest)}`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          {lead.nextFollowUpAt
                            ? `Next follow-up: ${lead.nextFollowUpAt}`
                            : "Next follow-up not recorded"}
                          {lead.expectedCloseDate
                            ? ` · Expected close: ${lead.expectedCloseDate}`
                            : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-zinc-600">
              No Lead details are displayed for the current deterministic result.
            </p>
          )}

          <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-xs leading-5 text-zinc-600">
            <p className="font-bold text-zinc-800">Recorded metadata only</p>
            <p className="mt-1">
              Category membership comes from structured Lead fields. Human
              priority is display-only and does not affect eligibility, ordering
              or selection.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
