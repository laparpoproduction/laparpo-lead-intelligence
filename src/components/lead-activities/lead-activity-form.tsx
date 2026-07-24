"use client";

import {
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createLeadActivityAction,
  updateLeadActivityAction,
} from "@/app/(dashboard)/leads/activities/actions";
import {
  initialLeadActivityFormState,
  type LeadActivityFormState,
} from "@/app/(dashboard)/leads/activities/form-state";
import {
  humanizeActivityType,
} from "@/lib/lead-activities/lead-activity-ui";
import {
  leadActivityTypeValues,
  type LeadActivity,
  type LeadActivityActor,
} from "@/lib/lead-activities/lead-activity.types";

const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-[#e5222a] focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

type Props = {
  actor: LeadActivityActor;
  defaultActivityAt: string;
  leadId: string;
  mode: "create" | "edit";
  activity?: LeadActivity;
  triggerLabel?: string;
};

function SubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();
  const idleLabel = mode === "create" ? "Add activity" : "Save changes";
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e5222a] px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving activity…" : idleLabel}
      {pending ? (
        <span className="sr-only" role="status">
          Activity submission is processing
        </span>
      ) : null}
    </button>
  );
}

function FieldError({
  id,
  name,
  state,
}: {
  id: string;
  name: string;
  state: LeadActivityFormState;
}) {
  const error = state.fieldErrors?.[name]?.[0];
  return error ? (
    <p className="mt-1.5 text-xs font-medium text-red-700" id={id}>
      {error}
    </p>
  ) : null;
}

function feedbackTitle(state: LeadActivityFormState): string {
  if (state.code === "unauthenticated") return "Sign-in required";
  if (state.code === "inactive") return "Account inactive";
  if (state.status === "permission_error") return "Permission denied";
  if (state.status === "not_found") return "Activity not found";
  if (state.status === "validation_error") return "Check activity details";
  return "Unable to save activity";
}

export function LeadActivityForm({
  actor,
  defaultActivityAt,
  leadId,
  mode,
  activity,
  triggerLabel,
}: Props) {
  const router = useRouter();
  const prefix = useId().replaceAll(":", "");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    mode === "create"
      ? createLeadActivityAction
      : updateLeadActivityAction,
    initialLeadActivityFormState,
  );
  const [values, setValues] = useState({
    activityType: activity?.activityType ?? "call",
    activityAt: activity?.activityAt ?? defaultActivityAt,
    subject: activity?.subject ?? "",
    description: activity?.description ?? "",
    outcome: activity?.outcome ?? "",
    nextFollowUpAt: activity?.nextFollowUpAt ?? "",
    assignedTo: activity?.assignedTo ?? "",
  });
  const management =
    actor.role === "ceo_admin" || actor.role === "sales_manager";
  const canSelfAssign =
    mode === "create" ||
    (activity?.assignedTo === null && activity.createdBy === actor.userId);
  const dialogTitleId = `${prefix}-title`;
  const fieldId = (name: string) => `${prefix}-${name}`;
  const invalid = (name: string) =>
    Boolean(state.fieldErrors?.[name]?.length);
  const closeDialog = () => {
    dialogRef.current?.close();
    setOpen(false);
  };

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open]);

  useEffect(() => {
    if (state.status === "validation_error") {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
    } else if (
      state.status === "permission_error" ||
      state.status === "not_found" ||
      state.status === "error"
    ) {
      feedbackRef.current?.focus();
    } else if (state.status === "success") {
      dialogRef.current?.close();
      if (mode === "create") router.replace(`/leads/${leadId}`);
      router.refresh();
    }
  }, [leadId, mode, router, state.status]);

  const textField = (
    name: string,
    label: string,
    defaultValue: string | null | undefined,
    options: {
      helper?: string;
      placeholder?: string;
      required?: boolean;
    } = {},
  ) => {
    const errorId = `${fieldId(name)}-error`;
    const helperId = `${fieldId(name)}-help`;
    return (
      <div>
        <label
          className="mb-1.5 block text-sm font-bold text-zinc-800"
          htmlFor={fieldId(name)}
        >
          {label}
          {options.required ? (
            <span aria-hidden="true" className="ml-1 text-[#e5222a]">
              *
            </span>
          ) : null}
        </label>
        <input
          aria-describedby={[
            invalid(name) ? errorId : null,
            options.helper ? helperId : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined}
          aria-invalid={invalid(name)}
          className={inputClass}
          id={fieldId(name)}
          name={name}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              [name]: event.target.value,
            }))
          }
          placeholder={options.placeholder}
          required={options.required}
          type="text"
          value={
            values[name as keyof typeof values] ??
            defaultValue ??
            ""
          }
        />
        {options.helper ? (
          <p
            className="mt-1.5 text-xs leading-5 text-zinc-500"
            id={helperId}
          >
            {options.helper}
          </p>
        ) : null}
        <FieldError id={errorId} name={name} state={state} />
      </div>
    );
  };

  return (
    <>
      <button
        className={
          mode === "create"
            ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e5222a] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#c91920]"
            : "inline-flex min-h-10 items-center justify-center rounded-lg border border-zinc-200 px-3.5 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
        }
        onClick={() => setOpen(true)}
        type="button"
      >
        {triggerLabel ?? (mode === "create" ? "Add Activity" : "Edit activity")}
      </button>
      {open ? <dialog
        aria-labelledby={dialogTitleId}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/45"
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <form
          action={formAction}
          className="p-5 sm:p-6"
          noValidate
          ref={formRef}
        >
          {mode === "create" ? (
            <input name="leadId" type="hidden" value={leadId} />
          ) : (
            <input name="activityId" type="hidden" value={activity?.id} />
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black" id={dialogTitleId}>
                {mode === "create" ? "Add Activity" : "Edit activity"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-500">
                Record a CRM touchpoint and the next follow-up without changing
                Lead ownership.
              </p>
            </div>
            <button
              aria-label="Close activity form"
              className="grid min-h-10 min-w-10 place-items-center rounded-lg text-xl text-zinc-500 hover:bg-zinc-100"
              onClick={closeDialog}
              type="button"
            >
              ×
            </button>
          </div>

          {state.status !== "idle" && state.status !== "success" ? (
            <div
              aria-live="polite"
              className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
              ref={feedbackRef}
              role="alert"
              tabIndex={-1}
            >
              <p className="font-bold">{feedbackTitle(state)}</p>
              <p className="mt-1">{state.message}</p>
            </div>
          ) : null}

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block text-sm font-bold text-zinc-800"
                htmlFor={fieldId("activityType")}
              >
                Activity type
                <span aria-hidden="true" className="ml-1 text-[#e5222a]">
                  *
                </span>
              </label>
              <select
                aria-invalid={invalid("activityType")}
                className={inputClass}
                id={fieldId("activityType")}
                name="activityType"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    activityType:
                      event.target.value as LeadActivity["activityType"],
                  }))
                }
                value={values.activityType}
              >
                {leadActivityTypeValues.map((value) => (
                  <option key={value} value={value}>
                    {humanizeActivityType(value)}
                  </option>
                ))}
              </select>
              <FieldError
                id={`${fieldId("activityType")}-error`}
                name="activityType"
                state={state}
              />
            </div>
            {textField(
              "activityAt",
              "Activity date and time",
              activity?.activityAt ?? defaultActivityAt,
              {
                helper:
                  "Use ISO 8601 with timezone, for example 2026-07-24T15:30:00+08:00.",
                required: true,
              },
            )}
            <div className="sm:col-span-2">
              {textField("subject", "Subject", activity?.subject, {
                placeholder: "Discovery call, proposal sent…",
              })}
            </div>
            <div className="sm:col-span-2">
              <label
                className="mb-1.5 block text-sm font-bold text-zinc-800"
                htmlFor={fieldId("description")}
              >
                Description
              </label>
              <textarea
                aria-invalid={invalid("description")}
                className={`${inputClass} min-h-28 py-3`}
                id={fieldId("description")}
                name="description"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Notes, context and agreed actions"
                value={values.description}
              />
              <FieldError
                id={`${fieldId("description")}-error`}
                name="description"
                state={state}
              />
            </div>
            {textField("outcome", "Outcome", activity?.outcome, {
              placeholder: "Qualified, no answer, proposal accepted…",
            })}
            {textField(
              "nextFollowUpAt",
              "Next follow-up",
              activity?.nextFollowUpAt,
              {
                helper: "Optional ISO 8601 timestamp including timezone.",
              },
            )}
            <div className="sm:col-span-2">
              {management ? (
                textField(
                  "assignedTo",
                  "Assigned profile ID",
                  activity?.assignedTo,
                  { helper: "Optional eligible active profile UUID." },
                )
              ) : canSelfAssign ? (
                <div>
                  <p className="text-sm font-bold text-zinc-800">Assignment</p>
                  <label className="mt-2 flex min-h-11 items-center gap-3 rounded-xl border border-zinc-200 px-3.5 text-sm text-zinc-700">
                    <input
                      className="size-4 accent-[#e5222a]"
                      checked={values.assignedTo === actor.userId}
                      name="assignedTo"
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          assignedTo: event.target.checked ? actor.userId : "",
                        }))
                      }
                      type="checkbox"
                      value={actor.userId}
                    />
                    Assign this activity to me
                  </label>
                  <FieldError
                    id={`${fieldId("assignedTo")}-error`}
                    name="assignedTo"
                    state={state}
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm text-zinc-600">
                  Assignment is locked by server authorization rules.
                </div>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-zinc-100 pt-5 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-xl px-5 text-sm font-bold text-zinc-600 hover:bg-zinc-100"
              onClick={closeDialog}
              type="button"
            >
              Cancel
            </button>
            <SubmitButton mode={mode} />
          </div>
        </form>
      </dialog> : null}
    </>
  );
}
