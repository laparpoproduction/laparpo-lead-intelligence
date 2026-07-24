"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createLeadAction, updateLeadAction } from "@/app/(dashboard)/leads/actions";
import { initialLeadFormState, type LeadFormState } from "@/app/(dashboard)/leads/form-state";
import { LeadDuplicateWarning } from "./lead-duplicate-warning";
import { humanizeLeadValue, isLeadManagement } from "@/lib/leads/lead-ui";
import {
  leadPriorityValues,
  leadQualificationValues,
  leadServiceInterestValues,
  leadSourceTypeValues,
  leadStageValues,
  leadStatusValues,
  type Lead,
  type LeadActor,
} from "@/lib/leads/lead.types";

type Props =
  | { mode: "create"; actor: LeadActor; defaultDiscoveredAt: string; lead?: never }
  | { mode: "edit"; actor: LeadActor; lead: Lead; defaultDiscoveredAt?: never };

const inputClass = "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-[#e5222a] focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

function FieldError({ name, state }: { name: string; state: LeadFormState }) {
  const error = state.fieldErrors?.[name]?.[0];
  return error ? <p className="mt-1.5 text-xs font-medium text-red-700" id={`${name}-error`}>{error}</p> : null;
}

function TextField({
  name,
  label,
  state,
  defaultValue,
  type = "text",
  required,
  disabled,
  helper,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  state: LeadFormState;
  defaultValue?: string | number | null;
  type?: "date" | "number" | "text" | "url";
  required?: boolean;
  disabled?: boolean;
  helper?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  const invalid = Boolean(state.fieldErrors?.[name]?.length);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-zinc-800" htmlFor={name}>{label}{required ? <span aria-hidden="true" className="ml-1 text-[#e5222a]">*</span> : null}</label>
      <input
        aria-describedby={[invalid ? `${name}-error` : null, helper ? `${name}-help` : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={invalid}
        className={inputClass}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        id={name}
        max={max}
        min={min}
        name={disabled ? undefined : name}
        required={required}
        step={step}
        type={type}
      />
      {helper ? <p className="mt-1.5 text-xs leading-5 text-zinc-500" id={`${name}-help`}>{helper}</p> : null}
      <FieldError name={name} state={state} />
    </div>
  );
}

function SelectField({
  name,
  label,
  values,
  defaultValue,
  state,
  optional = false,
}: {
  name: string;
  label: string;
  values: readonly string[];
  defaultValue?: string | null;
  state: LeadFormState;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-zinc-800" htmlFor={name}>{label}</label>
      <select aria-invalid={Boolean(state.fieldErrors?.[name])} className={inputClass} defaultValue={defaultValue ?? ""} id={name} name={name}>
        {optional ? <option value="">Not specified</option> : null}
        {values.map((value) => <option key={value} value={value}>{humanizeLeadValue(value)}</option>)}
      </select>
      <FieldError name={name} state={state} />
    </div>
  );
}

function TextArea({ name, label, value, state }: { name: string; label: string; value?: string | null; state: LeadFormState }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-zinc-800" htmlFor={name}>{label}</label>
      <textarea aria-invalid={Boolean(state.fieldErrors?.[name])} className={`${inputClass} min-h-28 py-3`} defaultValue={value ?? ""} id={name} name={name} />
      <FieldError name={name} state={state} />
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <fieldset className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"><legend className="sr-only">{title}</legend><div className="mb-5"><h3 className="font-black text-zinc-950">{title}</h3><p className="mt-1 text-sm leading-5 text-zinc-500">{description}</p></div>{children}</fieldset>;
}

function Submit({ mode, confirming }: { mode: "create" | "edit"; confirming: boolean }) {
  const { pending } = useFormStatus();
  const label = confirming ? (mode === "create" ? "Create anyway" : "Apply update anyway") : (mode === "create" ? "Create lead" : "Save changes");
  return <button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e5222a] px-5 text-sm font-bold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : label}</button>;
}

function Assignment({ actor, lead, mode, state }: { actor: LeadActor; lead?: Lead; mode: "create" | "edit"; state: LeadFormState }) {
  if (isLeadManagement(actor)) return <TextField defaultValue={lead?.assignedTo} helper="Enter an eligible active profile UUID." label="Assigned profile ID" name="assignedTo" state={state} />;
  const canSelfAssign = mode === "create" || (lead?.assignedTo === null && lead.createdBy === actor.userId);
  if (canSelfAssign) return <div><p className="text-sm font-bold text-zinc-800">Assignment</p><label className="mt-2 flex min-h-11 items-center gap-3 rounded-xl border border-zinc-200 px-3.5 text-sm text-zinc-700"><input className="size-4 accent-[#e5222a]" defaultChecked={lead?.assignedTo === actor.userId} name="assignedTo" type="checkbox" value={actor.userId} />Assign this lead to me</label><FieldError name="assignedTo" state={state} /></div>;
  return <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm text-zinc-600">Assignment is locked by the server authorization rules.</div>;
}

export function LeadForm({ mode, actor, ...props }: Props) {
  const lead = mode === "edit" ? props.lead : undefined;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [dismissedToken, setDismissedToken] = useState<string | null>(null);
  const [state, formAction] = useActionState(mode === "create" ? createLeadAction : updateLeadAction, initialLeadFormState);
  const confirming = state.status === "duplicate_warning" && Boolean(state.confirmationToken) && state.confirmationToken !== dismissedToken;
  const management = isLeadManagement(actor);

  useEffect(() => {
    if (state.status === "duplicate_warning") feedbackRef.current?.querySelector<HTMLElement>("[role='alert']")?.focus();
    if (state.status === "validation_error") formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    if (state.status === "success" || state.status === "already_processed") {
      router.replace(state.redirectTo ?? (lead ? `/leads/${lead.id}` : "/leads"));
      router.refresh();
    }
  }, [lead, router, state.redirectTo, state.status]);

  return (
    <form action={formAction} className="space-y-5" noValidate ref={formRef}>
      {lead ? <input name="leadId" type="hidden" value={lead.id} /> : null}
      {confirming ? <input name="confirmationToken" type="hidden" value={state.confirmationToken} /> : null}
      <div ref={feedbackRef}>
        {confirming ? <LeadDuplicateWarning candidateIds={state.duplicateCandidateIds ?? []} mode={mode} onRevise={() => setDismissedToken(state.confirmationToken ?? null)} /> : state.status !== "idle" && state.status !== "duplicate_warning" ? (
          <div aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert" tabIndex={-1}><p className="font-bold">{state.status === "permission_error" ? "Permission denied" : "Unable to save"}</p><p className="mt-1">{state.message}</p></div>
        ) : null}
      </div>

      <Section description="Core pipeline position and commercial service fit." title="Lead overview">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><TextField defaultValue={lead?.title} label="Lead title" name="title" required state={state} /></div>
          <SelectField defaultValue={lead?.stage ?? "new"} label="Stage" name="stage" state={state} values={leadStageValues} />
          <SelectField defaultValue={lead?.leadStatus ?? "active"} label="Lead status" name="leadStatus" state={state} values={leadStatusValues} />
          <SelectField defaultValue={lead?.qualificationStatus ?? "unreviewed"} label="Qualification" name="qualificationStatus" state={state} values={leadQualificationValues} />
          <SelectField defaultValue={lead?.priority ?? "normal"} label="Priority" name="priority" state={state} values={leadPriorityValues} />
          <SelectField defaultValue={lead?.serviceInterest} label="Service interest" name="serviceInterest" optional state={state} values={leadServiceInterestValues} />
          <TextField defaultValue={lead?.leadScore} label="Lead score" max="100" min="0" name="leadScore" state={state} type="number" />
        </div>
      </Section>

      <Section description="Links use existing CRM UUIDs; server rules remain authoritative." title="Relationships and ownership">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={lead?.companyId} disabled={mode === "edit" && !management} helper={mode === "edit" && !management ? "Representatives cannot change a Lead Company." : "Optional accessible Company UUID."} label="Company ID" name="companyId" state={state} />
          <TextField defaultValue={lead?.primaryContactId} label="Primary contact ID" name="primaryContactId" state={state} />
          <Assignment actor={actor} lead={lead} mode={mode} state={state} />
        </div>
      </Section>

      <Section description="Expected value, timing and next action." title="Sales and follow-up">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={lead?.estimatedValue} label="Estimated value" min="0" name="estimatedValue" state={state} step="0.01" type="number" />
          <TextField defaultValue={lead?.currency ?? "MYR"} label="Currency" name="currency" state={state} />
          <TextField defaultValue={lead?.expectedCloseDate} label="Expected close date" name="expectedCloseDate" state={state} type="date" />
          <TextField defaultValue={lead?.nextFollowUpAt} helper="ISO 8601 timestamp including timezone." label="Next follow-up at" name="nextFollowUpAt" state={state} />
          <TextField defaultValue={lead?.lastContactedAt} helper="ISO 8601 timestamp including timezone." label="Last contacted at" name="lastContactedAt" state={state} />
          <TextField defaultValue={lead?.nextStep} label="Next step" name="nextStep" state={state} />
        </div>
      </Section>

      <Section description="Record the public evidence behind this Lead." title="Source provenance">
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField defaultValue={lead?.sourceType ?? "manual"} label="Source type" name="sourceType" state={state} values={leadSourceTypeValues} />
          <TextField defaultValue={lead?.sourceUrl} label="Source URL" name="sourceUrl" state={state} type="url" />
          <TextField defaultValue={lead?.sourceCampaign} label="Source campaign" name="sourceCampaign" state={state} />
          <TextField defaultValue={lead?.sourceSignalId} label="Source signal ID" name="sourceSignalId" state={state} />
          <TextField defaultValue={lead?.referralName} label="Referral name" name="referralName" state={state} />
          <TextField defaultValue={lead?.discoveredAt ?? (mode === "create" ? props.defaultDiscoveredAt : "")} helper="Required ISO 8601 timestamp including timezone." label="Discovered at" name="discoveredAt" required state={state} />
          <TextField defaultValue={lead?.lastVerifiedAt} label="Last verified at" name="lastVerifiedAt" state={state} />
        </div>
      </Section>

      <Section description="Private sales context. Avoid unnecessary sensitive personal data." title="Qualification notes">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextArea label="Business need" name="businessNeed" state={state} value={lead?.businessNeed} />
          <TextArea label="Budget notes" name="budgetNotes" state={state} value={lead?.budgetNotes} />
          <TextArea label="Timeline notes" name="timelineNotes" state={state} value={lead?.timelineNotes} />
          <TextArea label="Decision-maker notes" name="decisionMakerNotes" state={state} value={lead?.decisionMakerNotes} />
          <div className="sm:col-span-2"><TextArea label="General notes" name="notes" state={state} value={lead?.notes} /></div>
        </div>
      </Section>

      <div className="sticky bottom-3 flex flex-col-reverse gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
        <button className="min-h-11 rounded-xl px-5 text-sm font-bold text-zinc-600 hover:bg-zinc-100" onClick={() => router.push(lead ? `/leads/${lead.id}` : "/leads")} type="button">Cancel</button>
        <Submit confirming={confirming} mode={mode} />
      </div>
    </form>
  );
}
