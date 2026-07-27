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
import { convertLeadToOpportunityAction } from "@/app/(dashboard)/leads/conversion/actions";
import {
  initialLeadConversionActionState,
  type LeadConversionActionState,
} from "@/app/(dashboard)/leads/conversion/form-state";
import {
  defaultEstimatedValueMyr,
  mapLeadServiceToOpportunity,
  opportunityServiceOptions,
} from "@/lib/opportunities/opportunity-ui";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 shadow-sm focus:border-[#e5222a] focus:outline-none disabled:cursor-wait disabled:bg-zinc-100";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e5222a] px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Converting…" : "Confirm conversion"}
      {pending ? (
        <span className="sr-only" role="status">
          Lead conversion is processing
        </span>
      ) : null}
    </button>
  );
}

function FieldError({
  id,
  field,
  state,
}: {
  id: string;
  field: string;
  state: LeadConversionActionState;
}) {
  const error = state.fieldErrors?.[field]?.[0];
  return error ? (
    <p className="mt-1.5 text-xs font-medium text-red-700" id={id}>
      {error}
    </p>
  ) : null;
}

export function LeadConversionDialog({
  currency,
  estimatedValue,
  leadId,
  serviceInterest,
  title,
}: {
  currency: string;
  estimatedValue: number | null;
  leadId: string;
  serviceInterest: string | null;
  title: string;
}) {
  const prefix = useId().replaceAll(":", "");
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const serviceRef = useRef<HTMLSelectElement>(null);
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    convertLeadToOpportunityAction,
    initialLeadConversionActionState,
  );
  const defaultService = mapLeadServiceToOpportunity(serviceInterest);
  const defaultValue = defaultEstimatedValueMyr(currency, estimatedValue);
  const serviceId = `${prefix}-service`;
  const valueId = `${prefix}-estimated-value`;
  const serviceErrorId = `${serviceId}-error`;
  const valueErrorId = `${valueId}-error`;
  const valueHelpId = `${valueId}-help`;
  const titleId = `${prefix}-title`;
  const feedbackId = `${prefix}-feedback`;
  const invalid = (field: string) =>
    Boolean(state.fieldErrors?.[field]?.length);

  useEffect(() => {
    if (!open || dialogRef.current?.open) return;
    dialogRef.current?.showModal();
    serviceRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (state.status === "validation_error") {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
      return;
    }
    if (state.status === "success" || state.status === "already_converted") {
      router.refresh();
      return;
    }
    if (state.status !== "idle") feedbackRef.current?.focus();
  }, [router, state.status]);

  const close = () => {
    dialogRef.current?.close();
    setOpen(false);
  };
  const success =
    state.status === "success" || state.status === "already_converted";

  return (
    <>
      <button
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#e5222a] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#c91920]"
        onClick={() => setOpen(true)}
        type="button"
      >
        Convert to Opportunity
      </button>
      {open ? (
        <dialog
          aria-describedby={feedbackId}
          aria-labelledby={titleId}
          className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/45"
          onClose={() => setOpen(false)}
          ref={dialogRef}
        >
          <form action={formAction} className="p-5 sm:p-6" noValidate ref={formRef}>
            <input name="leadId" type="hidden" value={leadId} />
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-black" id={titleId}>
                  Convert {title}?
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  This creates the conversion Opportunity, changes the Lead
                  stage to Converted, closes the Lead, and preserves it as
                  historical CRM information.
                </p>
              </div>
              <button
                aria-label="Close conversion dialog"
                className="grid min-h-11 min-w-11 place-items-center rounded-lg text-xl text-zinc-500 hover:bg-zinc-100"
                onClick={close}
                type="button"
              >
                ×
              </button>
            </div>

            {state.status !== "idle" ? (
              <div
                aria-live="polite"
                className={`mt-5 rounded-xl border p-4 text-sm ${
                  success
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-red-200 bg-red-50 text-red-900"
                }`}
                id={feedbackId}
                ref={feedbackRef}
                role={success ? "status" : "alert"}
                tabIndex={-1}
              >
                <p className="font-bold">
                  {success ? "Conversion complete" : "Conversion not completed"}
                </p>
                <p className="mt-1">{state.message}</p>
                {state.opportunityId ? (
                  <p className="mt-2 break-all text-xs">
                    Opportunity ID: {state.opportunityId}
                  </p>
                ) : null}
              </div>
            ) : (
              <span className="sr-only" id={feedbackId}>
                Complete the conversion fields and confirm.
              </span>
            )}

            {!success ? (
              <>
                <div className="mt-6 space-y-5">
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-bold text-zinc-800"
                      htmlFor={serviceId}
                    >
                      Opportunity service
                    </label>
                    <select
                      aria-describedby={
                        invalid("service") ? serviceErrorId : undefined
                      }
                      aria-invalid={invalid("service")}
                      className={fieldClass}
                      defaultValue={defaultService ?? ""}
                      id={serviceId}
                      name="service"
                      ref={serviceRef}
                      required
                    >
                      <option disabled value="">
                        Select a service
                      </option>
                      {opportunityServiceOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <FieldError
                      field="service"
                      id={serviceErrorId}
                      state={state}
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1.5 block text-sm font-bold text-zinc-800"
                      htmlFor={valueId}
                    >
                      Estimated value (MYR)
                    </label>
                    <input
                      aria-describedby={[
                        invalid("estimatedValueMyr") ? valueErrorId : null,
                        valueHelpId,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      aria-invalid={invalid("estimatedValueMyr")}
                      className={fieldClass}
                      defaultValue={defaultValue ?? ""}
                      id={valueId}
                      inputMode="decimal"
                      max="9999999999.99"
                      min="0"
                      name="estimatedValueMyr"
                      placeholder="Optional"
                      step="0.01"
                      type="number"
                    />
                    <p
                      className="mt-1.5 text-xs leading-5 text-zinc-500"
                      id={valueHelpId}
                    >
                      {currency === "MYR"
                        ? "Blank remains unset."
                        : `The Lead value is in ${currency}. No automatic FX conversion is performed; enter an explicit MYR value or leave this blank.`}
                    </p>
                    <FieldError
                      field="estimatedValueMyr"
                      id={valueErrorId}
                      state={state}
                    />
                  </div>
                </div>
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    className="min-h-11 rounded-xl px-4 text-sm font-bold text-zinc-600 hover:bg-zinc-100"
                    onClick={close}
                    type="button"
                  >
                    Cancel
                  </button>
                  <SubmitButton />
                </div>
              </>
            ) : (
              <button
                className="mt-6 min-h-11 w-full rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white"
                onClick={close}
                type="button"
              >
                Close
              </button>
            )}
          </form>
        </dialog>
      ) : null}
    </>
  );
}
