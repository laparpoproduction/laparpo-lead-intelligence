"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { generateCompanyIntelligenceAction } from "@/app/(dashboard)/companies/intelligence-actions";
import {
  initialCompanyIntelligenceActionState,
  type CompanyIntelligenceActionState,
} from "@/app/(dashboard)/companies/intelligence-state";

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e5222a] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#c91920] disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Generating…" : "Generate AI intelligence"}
      {pending ? (
        <span className="sr-only" role="status">
          Company intelligence is generating
        </span>
      ) : null}
    </button>
  );
}

function ResultList({
  items,
  emptyLabel,
}: {
  items: string[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="mt-2 text-sm text-zinc-500">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">
      {items.map((item, index) => (
        <li className="flex min-w-0 gap-2" key={`${index}-${item}`}>
          <span aria-hidden="true" className="text-[#e5222a]">
            •
          </span>
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function IntelligenceResult({
  state,
}: {
  state: CompanyIntelligenceActionState;
}) {
  const result = state.intelligence;
  if (!result) return null;

  return (
    <div
      aria-label="AI-generated Company intelligence"
      className="mt-6 grid gap-5 border-t border-zinc-200 pt-6"
      role="region"
    >
      <div>
        <h3 className="text-sm font-black text-zinc-950">Summary</h3>
        <p className="mt-2 break-words text-sm leading-6 text-zinc-700">
          {result.summary}
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-black text-zinc-950">Business signals</h3>
          <ResultList
            emptyLabel="No clear business signals were identified."
            items={result.businessSignals}
          />
        </div>
        <div>
          <h3 className="text-sm font-black text-zinc-950">Data-quality gaps</h3>
          <ResultList
            emptyLabel="No obvious data-quality gaps were identified."
            items={result.dataQualityGaps}
          />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-black text-zinc-950">
          Recommended next steps
        </h3>
        <ResultList
          emptyLabel="No next steps were suggested."
          items={result.recommendedNextSteps}
        />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-zinc-500">
        Confidence: {result.confidence}
      </p>
    </div>
  );
}

export function CompanyIntelligence({ companyId }: { companyId: string }) {
  const [state, formAction] = useActionState(
    generateCompanyIntelligenceAction,
    initialCompanyIntelligenceActionState,
  );
  const success = state.status === "success";

  return (
    <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#e5222a]">
        AI-generated
      </p>
      <h2 className="mt-2 text-lg font-black text-zinc-950">
        Company intelligence
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
        Generate a non-binding summary and next-step suggestions from allow-listed
        public Company metadata only.
      </p>
      <p className="mt-2 text-sm font-semibold text-zinc-800">
        Recommendation only — no CRM data will be changed.
      </p>

      <form action={formAction} className="mt-5">
        <input name="companyId" type="hidden" value={companyId} />
        <GenerateButton />
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
            {success ? "Recommendation ready" : "Recommendation unavailable"}
          </p>
          <p className="mt-1">{state.message}</p>
        </div>
      ) : null}

      <IntelligenceResult state={state} />
    </section>
  );
}
