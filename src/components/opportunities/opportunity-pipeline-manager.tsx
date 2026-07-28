"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  assignOpportunityOwnerAction,
  changeOpportunityStageAction,
  clearOpportunityProbabilityOverrideAction,
  markOpportunityLostAction,
  markOpportunityWonAction,
  overrideOpportunityProbabilityAction,
  setOpportunityExpectedCloseDateAction,
} from "@/app/(dashboard)/opportunities/actions";
import {
  initialOpportunityMutationActionState,
  type OpportunityMutationActionState,
} from "@/app/(dashboard)/opportunities/form-state";
import type { AppRole } from "@/lib/auth/permissions";
import type {
  OpportunityListItem,
  OpportunityOwnerProfile,
} from "@/lib/opportunities/opportunity.types";
import {
  compactOpportunityId,
  opportunityLossReasonOptions,
  opportunityStageOptions,
} from "@/lib/opportunities/opportunity-ui";

type MutationAction = (
  state: OpportunityMutationActionState,
  formData: FormData,
) => Promise<OpportunityMutationActionState>;

const fieldClass =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 shadow-sm outline-none transition focus:border-[#e5222a] focus:ring-2 focus:ring-red-100 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-100 disabled:cursor-wait disabled:bg-zinc-100";

function SubmitButton({
  idle,
  pending,
  tone = "dark",
}: {
  idle: string;
  pending: string;
  tone?: "dark" | "red";
}) {
  const { pending: isPending } = useFormStatus();
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-white transition disabled:cursor-wait disabled:opacity-60 ${
        tone === "red"
          ? "bg-[#e5222a] hover:bg-[#c91920]"
          : "bg-zinc-950 hover:bg-zinc-800"
      }`}
      disabled={isPending}
      type="submit"
    >
      {isPending ? pending : idle}
      {isPending ? (
        <span className="sr-only" role="status">
          {pending}
        </span>
      ) : null}
    </button>
  );
}

function FieldError({
  field,
  id,
  state,
}: {
  field: string;
  id: string;
  state: OpportunityMutationActionState;
}) {
  const error = state.fieldErrors?.[field]?.[0];
  return error ? (
    <p className="mt-1.5 text-xs font-semibold text-red-700" id={id}>
      {error}
    </p>
  ) : null;
}

function MutationForm({
  action,
  children,
  className = "",
  expectedUpdatedAt,
  opportunityId,
}: {
  action: MutationAction;
  children: (context: {
    prefix: string;
    state: OpportunityMutationActionState;
  }) => ReactNode;
  className?: string;
  expectedUpdatedAt: string;
  opportunityId: string;
}) {
  const router = useRouter();
  const prefix = useId().replaceAll(":", "");
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState(
    action,
    initialOpportunityMutationActionState,
  );
  const successful =
    state.status === "success" || state.status === "already_applied";

  useEffect(() => {
    if (state.status === "validation_error") {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
      return;
    }
    if (
      successful ||
      state.status === "conflict" ||
      state.status === "not_found"
    ) {
      router.refresh();
    }
    if (state.status !== "idle") feedbackRef.current?.focus();
  }, [router, state.status, successful]);

  return (
    <form
      action={formAction}
      className={className}
      ref={formRef}
    >
      <input name="opportunityId" type="hidden" value={opportunityId} />
      <input
        name="expectedUpdatedAt"
        type="hidden"
        value={expectedUpdatedAt}
      />
      {state.status !== "idle" ? (
        <div
          aria-live="polite"
          className={`mb-4 rounded-xl border p-3 text-sm ${
            successful
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
          ref={feedbackRef}
          role={successful ? "status" : "alert"}
          tabIndex={-1}
        >
          <p className="font-bold">
            {successful ? "Update complete" : "Update not completed"}
          </p>
          <p className="mt-1">{state.message}</p>
        </div>
      ) : null}
      {children({ prefix, state })}
    </form>
  );
}

function StageWorkflow({
  opportunity,
}: {
  opportunity: OpportunityListItem;
}) {
  const activeStages = opportunityStageOptions.filter(
    (option) =>
      option.value !== "won" &&
      option.value !== "lost" &&
      option.value !== opportunity.pipelineStage,
  );
  if (activeStages.length === 0) return null;
  return (
    <MutationForm
      action={changeOpportunityStageAction}
      className="rounded-xl border border-zinc-200 p-4"
      expectedUpdatedAt={opportunity.updatedAt}
      opportunityId={opportunity.id}
    >
      {({ prefix, state }) => {
        const fieldId = `${prefix}-stage`;
        const errorId = `${fieldId}-error`;
        const invalid = Boolean(state.fieldErrors?.pipelineStage?.length);
        return (
          <>
            <h3 className="font-black text-zinc-950">Move Opportunity</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Choose another active stage, then confirm the move.
            </p>
            <label
              className="mb-1.5 mt-4 block text-sm font-bold text-zinc-800"
              htmlFor={fieldId}
            >
              Target stage
            </label>
            <select
              aria-describedby={invalid ? errorId : undefined}
              aria-invalid={invalid}
              className={fieldClass}
              defaultValue=""
              id={fieldId}
              name="pipelineStage"
              required
            >
              <option disabled value="">
                Select target stage
              </option>
              {activeStages.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldError
              field="pipelineStage"
              id={errorId}
              state={state}
            />
            <div className="mt-4 flex justify-end">
              <SubmitButton idle="Confirm move" pending="Moving…" />
            </div>
          </>
        );
      }}
    </MutationForm>
  );
}

function OwnerWorkflow({
  actorId,
  actorRole,
  opportunity,
  ownerProfiles,
}: {
  actorId: string;
  actorRole: AppRole;
  opportunity: OpportunityListItem;
  ownerProfiles: OpportunityOwnerProfile[];
}) {
  const management =
    actorRole === "ceo_admin" || actorRole === "sales_manager";
  if (!management && opportunity.ownerId !== null) return null;
  const activeProfiles = ownerProfiles.filter((profile) => profile.isActive);
  const currentProfile = ownerProfiles.find(
    (profile) => profile.id === opportunity.ownerId,
  );
  const label = (profile: OpportunityOwnerProfile) =>
    profile.fullName ?? `Team member ${compactOpportunityId(profile.id)}`;

  return (
    <MutationForm
      action={assignOpportunityOwnerAction}
      className="rounded-xl border border-zinc-200 p-4"
      expectedUpdatedAt={opportunity.updatedAt}
      opportunityId={opportunity.id}
    >
      {({ prefix, state }) => {
        const fieldId = `${prefix}-owner`;
        const errorId = `${fieldId}-error`;
        const invalid = Boolean(state.fieldErrors?.ownerId?.length);
        return (
          <>
            <h3 className="font-black text-zinc-950">Owner</h3>
            {management ? (
              <>
                <label
                  className="mb-1.5 mt-4 block text-sm font-bold text-zinc-800"
                  htmlFor={fieldId}
                >
                  Opportunity owner
                </label>
                <select
                  aria-describedby={invalid ? errorId : undefined}
                  aria-invalid={invalid}
                  className={fieldClass}
                  defaultValue={opportunity.ownerId ?? ""}
                  id={fieldId}
                  name="ownerId"
                >
                  <option value="">Unassigned</option>
                  {opportunity.ownerId &&
                  !activeProfiles.some(
                    (profile) => profile.id === opportunity.ownerId,
                  ) ? (
                    <option disabled value={opportunity.ownerId}>
                      {currentProfile
                        ? `${label(currentProfile)} — inactive`
                        : `Unavailable owner ${compactOpportunityId(opportunity.ownerId)}`}
                    </option>
                  ) : null}
                  {activeProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {label(profile)}
                    </option>
                  ))}
                </select>
                <FieldError field="ownerId" id={errorId} state={state} />
                <div className="mt-4 flex justify-end">
                  <SubmitButton idle="Save owner" pending="Assigning…" />
                </div>
              </>
            ) : (
              <>
                <input name="ownerId" type="hidden" value={actorId} />
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  This Opportunity is genuinely unassigned. You may claim it
                  for yourself; representatives cannot assign another user or
                  replace an existing owner.
                </p>
                <div className="mt-4 flex justify-end">
                  <SubmitButton
                    idle="Claim for myself"
                    pending="Assigning…"
                  />
                </div>
              </>
            )}
          </>
        );
      }}
    </MutationForm>
  );
}

function ExpectedCloseWorkflow({
  opportunity,
}: {
  opportunity: OpportunityListItem;
}) {
  return (
    <MutationForm
      action={setOpportunityExpectedCloseDateAction}
      className="rounded-xl border border-zinc-200 p-4"
      expectedUpdatedAt={opportunity.updatedAt}
      opportunityId={opportunity.id}
    >
      {({ prefix, state }) => {
        const fieldId = `${prefix}-expected-close`;
        const helpId = `${fieldId}-help`;
        const errorId = `${fieldId}-error`;
        const invalid = Boolean(state.fieldErrors?.expectedCloseDate?.length);
        return (
          <>
            <h3 className="font-black text-zinc-950">Expected close</h3>
            <label
              className="mb-1.5 mt-4 block text-sm font-bold text-zinc-800"
              htmlFor={fieldId}
            >
              Expected close date
            </label>
            <input
              aria-describedby={`${helpId}${invalid ? ` ${errorId}` : ""}`}
              aria-invalid={invalid}
              className={fieldClass}
              defaultValue={opportunity.expectedCloseDate ?? ""}
              id={fieldId}
              name="expectedCloseDate"
              type="date"
            />
            <p className="mt-1.5 text-xs leading-5 text-zinc-500" id={helpId}>
              Past dates are valid. Leave blank to clear this date; no stage or
              probability changes are made.
            </p>
            <FieldError
              field="expectedCloseDate"
              id={errorId}
              state={state}
            />
            <div className="mt-4 flex justify-end">
              <SubmitButton idle="Save date" pending="Saving…" />
            </div>
          </>
        );
      }}
    </MutationForm>
  );
}

function ProbabilityWorkflow({
  opportunity,
}: {
  opportunity: OpportunityListItem;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <MutationForm
        action={overrideOpportunityProbabilityAction}
        expectedUpdatedAt={opportunity.updatedAt}
        opportunityId={opportunity.id}
      >
        {({ prefix, state }) => {
          const fieldId = `${prefix}-probability`;
          const helpId = `${fieldId}-help`;
          const errorId = `${fieldId}-error`;
          const invalid = Boolean(
            state.fieldErrors?.probabilityPercent?.length,
          );
          return (
            <>
              <h3 className="font-black text-zinc-950">
                Probability override
              </h3>
              <label
                className="mb-1.5 mt-4 block text-sm font-bold text-zinc-800"
                htmlFor={fieldId}
              >
                Probability percent
              </label>
              <input
                aria-describedby={`${helpId}${invalid ? ` ${errorId}` : ""}`}
                aria-invalid={invalid}
                className={fieldClass}
                defaultValue={opportunity.probabilityPercent}
                id={fieldId}
                inputMode="numeric"
                max="100"
                min="0"
                name="probabilityPercent"
                required
                step="1"
                type="number"
              />
              <p
                className="mt-1.5 text-xs leading-5 text-zinc-500"
                id={helpId}
              >
                Management only. Values must be from 0 to 100.
              </p>
              <FieldError
                field="probabilityPercent"
                id={errorId}
                state={state}
              />
              <div className="mt-4 flex justify-end">
                <SubmitButton idle="Apply override" pending="Saving…" />
              </div>
            </>
          );
        }}
      </MutationForm>
      {opportunity.probabilityOverridden ? (
        <MutationForm
          action={clearOpportunityProbabilityOverrideAction}
          className="mt-4 border-t border-zinc-100 pt-4"
          expectedUpdatedAt={opportunity.updatedAt}
          opportunityId={opportunity.id}
        >
          {() => (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-zinc-500">
                Clear the manual override to restore the database-authoritative
                stage probability.
              </p>
              <SubmitButton
                idle="Use stage default"
                pending="Saving…"
              />
            </div>
          )}
        </MutationForm>
      ) : null}
    </div>
  );
}

function WonWorkflow({
  opportunity,
}: {
  opportunity: OpportunityListItem;
}) {
  return (
    <MutationForm
      action={markOpportunityWonAction}
      className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4"
      expectedUpdatedAt={opportunity.updatedAt}
      opportunityId={opportunity.id}
    >
      {({ prefix }) => {
        const confirmId = `${prefix}-confirm-won`;
        return (
          <>
            <h3 className="font-black text-emerald-950">Mark Won</h3>
            <p className="mt-1 text-sm leading-6 text-emerald-900">
              Won means the client has confirmed the work will proceed. A
              deposit is not required.
            </p>
            <label
              className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-white p-3 text-sm font-semibold text-emerald-950"
              htmlFor={confirmId}
            >
              <input
                className="mt-0.5 size-5 accent-emerald-700"
                id={confirmId}
                name="confirmWon"
                required
                type="checkbox"
              />
              I confirm the client has agreed that this work will proceed.
            </label>
            <div className="mt-4 flex justify-end">
              <SubmitButton
                idle="Mark Opportunity Won"
                pending="Marking Won…"
              />
            </div>
          </>
        );
      }}
    </MutationForm>
  );
}

function LostWorkflow({
  opportunity,
}: {
  opportunity: OpportunityListItem;
}) {
  const [reason, setReason] = useState("");
  return (
    <MutationForm
      action={markOpportunityLostAction}
      className="rounded-xl border border-red-200 bg-red-50/50 p-4"
      expectedUpdatedAt={opportunity.updatedAt}
      opportunityId={opportunity.id}
    >
      {({ prefix, state }) => {
        const reasonId = `${prefix}-lost-reason`;
        const reasonErrorId = `${reasonId}-error`;
        const notesId = `${prefix}-lost-notes`;
        const notesErrorId = `${notesId}-error`;
        const confirmId = `${prefix}-confirm-lost`;
        const reasonInvalid = Boolean(state.fieldErrors?.lostReason?.length);
        const notesInvalid = Boolean(
          state.fieldErrors?.lostReasonNotes?.length,
        );
        return (
          <>
            <h3 className="font-black text-red-950">Mark Lost</h3>
            <p className="mt-1 text-sm leading-6 text-red-900">
              This is a terminal outcome and cannot be reopened through the
              ordinary pipeline workflow.
            </p>
            <label
              className="mb-1.5 mt-4 block text-sm font-bold text-red-950"
              htmlFor={reasonId}
            >
              Lost reason
            </label>
            <select
              aria-describedby={reasonInvalid ? reasonErrorId : undefined}
              aria-invalid={reasonInvalid}
              className={fieldClass}
              id={reasonId}
              name="lostReason"
              onChange={(event) => setReason(event.currentTarget.value)}
              required
              value={reason}
            >
              <option disabled value="">
                Select a reason
              </option>
              {opportunityLossReasonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <FieldError
              field="lostReason"
              id={reasonErrorId}
              state={state}
            />
            <label
              className="mb-1.5 mt-4 block text-sm font-bold text-red-950"
              htmlFor={notesId}
            >
              Lost reason notes {reason === "other" ? "(required)" : "(optional)"}
            </label>
            <textarea
              aria-describedby={notesInvalid ? notesErrorId : undefined}
              aria-invalid={notesInvalid}
              className={`${fieldClass} min-h-24 py-3`}
              id={notesId}
              maxLength={2000}
              name="lostReasonNotes"
              required={reason === "other"}
            />
            <FieldError
              field="lostReasonNotes"
              id={notesErrorId}
              state={state}
            />
            <label
              className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-white p-3 text-sm font-semibold text-red-950"
              htmlFor={confirmId}
            >
              <input
                className="mt-0.5 size-5 accent-red-700"
                id={confirmId}
                name="confirmLost"
                required
                type="checkbox"
              />
              I confirm this Opportunity should be recorded as Lost.
            </label>
            <div className="mt-4 flex justify-end">
              <SubmitButton
                idle="Mark Opportunity Lost"
                pending="Marking Lost…"
                tone="red"
              />
            </div>
          </>
        );
      }}
    </MutationForm>
  );
}

export function OpportunityPipelineManager({
  actorId,
  actorRole,
  canModify,
  opportunity,
  ownerProfiles,
}: {
  actorId: string;
  actorRole: AppRole;
  canModify: boolean;
  opportunity: OpportunityListItem;
  ownerProfiles: OpportunityOwnerProfile[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId().replaceAll(":", "");
  const [open, setOpen] = useState(false);
  const terminal =
    opportunity.pipelineStage === "won" ||
    opportunity.pipelineStage === "lost";
  const management =
    actorRole === "ceo_admin" || actorRole === "sales_manager";

  useEffect(() => {
    if (!open || dialogRef.current?.open) return;
    dialogRef.current?.showModal();
  }, [open]);

  if (!canModify) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-950">
        Read-only Opportunity. Company-derived access does not grant mutation
        permission.
      </p>
    );
  }

  return (
    <>
      <button
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-900 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5222a] focus-visible:ring-offset-2"
        onClick={() => setOpen(true)}
        type="button"
      >
        Manage Opportunity
      </button>
      {open ? (
        <dialog
          aria-labelledby={titleId}
          className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/45"
          onClose={() => setOpen(false)}
          ref={dialogRef}
        >
          <div className="p-5 sm:p-6">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#c91920]">
                  Pipeline workflow
                </p>
                <h2
                  className="mt-1 break-words text-xl font-black"
                  id={titleId}
                >
                  Manage {opportunity.leadTitle}
                </h2>
                <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                  {opportunity.id}
                </p>
              </div>
              <button
                aria-label="Close Opportunity workflow"
                className="grid min-h-11 min-w-11 place-items-center rounded-xl text-xl text-zinc-500 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5222a]"
                onClick={() => {
                  dialogRef.current?.close();
                  setOpen(false);
                }}
                type="button"
              >
                ×
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {!terminal ? <StageWorkflow opportunity={opportunity} /> : null}
              <OwnerWorkflow
                actorId={actorId}
                actorRole={actorRole}
                opportunity={opportunity}
                ownerProfiles={ownerProfiles}
              />
              <ExpectedCloseWorkflow opportunity={opportunity} />
              {!terminal && management ? (
                <ProbabilityWorkflow opportunity={opportunity} />
              ) : null}
              {!terminal ? <WonWorkflow opportunity={opportunity} /> : null}
              {!terminal ? <LostWorkflow opportunity={opportunity} /> : null}
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
