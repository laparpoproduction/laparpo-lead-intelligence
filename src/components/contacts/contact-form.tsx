"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createContactAction,
  updateContactAction,
} from "@/app/(dashboard)/contacts/actions";
import {
  initialContactFormState,
  type ContactFormState,
} from "@/app/(dashboard)/contacts/form-state";
import { ContactDuplicateWarning } from "./contact-duplicate-warning";
import type { Contact, ContactActor, ContactStatus } from "@/lib/contacts/contact.types";

type ContactFormProps =
  | {
      mode: "create";
      contact?: never;
      actor: ContactActor;
      defaultDiscoveredAt: string;
    }
  | {
      mode: "edit";
      contact: Contact;
      actor: ContactActor;
      defaultDiscoveredAt?: never;
    };

type FieldProps = {
  label: string;
  name: string;
  state: ContactFormState;
  defaultValue?: string | null;
  required?: boolean;
  type?: "email" | "tel" | "text" | "url";
  placeholder?: string;
  disabled?: boolean;
  helper?: string;
};

const inputClass = "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-[#e5222a] focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500";

const statusLabels: Record<ContactStatus, string> = {
  discovered: "Discovered",
  verified: "Verified",
  contacted: "Contacted",
  qualified: "Qualified",
  inactive: "Inactive",
  do_not_contact: "Do not contact",
};

function FieldError({ name, state }: { name: string; state: ContactFormState }) {
  const errors = state.fieldErrors?.[name];
  if (!errors?.length) return null;
  return <p className="mt-1.5 text-xs font-medium text-red-700" id={`${name}-error`}>{errors[0]}</p>;
}

function TextField({
  label,
  name,
  state,
  defaultValue,
  required,
  type = "text",
  placeholder,
  disabled,
  helper,
}: FieldProps) {
  const hasError = Boolean(state.fieldErrors?.[name]?.length);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-zinc-800" htmlFor={name}>
        {label}{required ? <span className="ml-1 text-[#e5222a]" aria-hidden="true">*</span> : null}
      </label>
      <input
        aria-describedby={[hasError ? `${name}-error` : null, helper ? `${name}-help` : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={hasError}
        className={inputClass}
        defaultValue={defaultValue ?? ""}
        disabled={disabled}
        id={name}
        name={disabled ? undefined : name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
      {helper ? <p className="mt-1.5 text-xs leading-5 text-zinc-500" id={`${name}-help`}>{helper}</p> : null}
      <FieldError name={name} state={state} />
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="mb-5">
        <h3 className="font-black text-zinc-950">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-zinc-500">{description}</p>
      </div>
      {children}
    </fieldset>
  );
}

function FormFeedback({ state }: { state: ContactFormState }) {
  if (state.status === "idle" || state.status === "duplicate_warning") return null;
  const success = state.status === "success" || state.status === "already_processed";
  return (
    <div
      aria-live="polite"
      className={`rounded-xl border p-4 text-sm ${success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}
      role={success ? "status" : "alert"}
      tabIndex={-1}
    >
      <p className="font-bold">{success ? "Saved" : state.status === "permission_error" ? "Permission denied" : "Unable to save"}</p>
      {state.message ? <p className="mt-1 leading-5 opacity-80">{state.message}</p> : null}
    </div>
  );
}

function SubmitButton({ mode, confirming }: { mode: "create" | "edit"; confirming: boolean }) {
  const { pending } = useFormStatus();
  const label = confirming
    ? mode === "create" ? "Create anyway" : "Apply update anyway"
    : mode === "create" ? "Create contact" : "Save changes";
  return (
    <button
      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#e5222a] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#c91920] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function AssignmentControl({
  mode,
  contact,
  actor,
  state,
}: {
  mode: "create" | "edit";
  contact?: Contact;
  actor: ContactActor;
  state: ContactFormState;
}) {
  const management = actor.role === "ceo_admin" || actor.role === "sales_manager";
  if (management) {
    return (
      <TextField
        defaultValue={contact?.assignedTo}
        helper="Enter an eligible active profile UUID. A bounded assignee selector is deferred."
        label="Assigned profile ID"
        name="assignedTo"
        placeholder="Optional UUID"
        state={state}
      />
    );
  }

  const canSelfAssign = mode === "create" || (
    contact?.assignedTo === null && contact.createdBy === actor.userId
  );
  if (canSelfAssign) {
    return (
      <div>
        <p className="text-sm font-bold text-zinc-800">Assignment</p>
        <label className="mt-2 flex min-h-11 items-center gap-3 rounded-xl border border-zinc-200 px-3.5 text-sm text-zinc-700">
          <input className="size-4 accent-[#e5222a]" name="assignedTo" type="checkbox" value={actor.userId} />
          Assign this contact to me
        </label>
        <FieldError name="assignedTo" state={state} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-sm text-zinc-600">
      Assignment is locked. Representatives cannot clear or take over another user&apos;s assignment.
    </div>
  );
}

export function ContactForm(props: ContactFormProps) {
  const { mode, actor } = props;
  const contact = mode === "edit" ? props.contact : undefined;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [dismissedConfirmationToken, setDismissedConfirmationToken] = useState<string | null>(null);
  const action = mode === "create" ? createContactAction : updateContactAction;
  const [state, formAction] = useActionState(action, initialContactFormState);
  const management = actor.role === "ceo_admin" || actor.role === "sales_manager";
  const confirming = state.status === "duplicate_warning"
    && Boolean(state.confirmationToken)
    && state.confirmationToken !== dismissedConfirmationToken;

  useEffect(() => {
    if (state.status === "duplicate_warning") {
      feedbackRef.current?.querySelector<HTMLElement>("[role='alert']")?.focus();
      return;
    }
    if (state.status === "validation_error") {
      formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
    }
    if (state.status === "success" || state.status === "already_processed") {
      router.replace(state.redirectTo ?? "/contacts");
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <form action={formAction} className="space-y-5" noValidate ref={formRef}>
      {mode === "edit" ? <input name="contactId" type="hidden" value={contact?.id} /> : null}
      {confirming ? <input name="confirmationToken" type="hidden" value={state.confirmationToken} /> : null}
      <div ref={feedbackRef}>
        {confirming ? (
          <ContactDuplicateWarning
            candidateIds={state.duplicateCandidateIds ?? []}
            mode={mode}
            onRevise={() => setDismissedConfirmationToken(state.confirmationToken ?? null)}
          />
        ) : (
          <FormFeedback state={state} />
        )}
      </div>

      <Section title="Contact identity" description="Preserve the person's cultural name. First and last names are optional aids, not assumptions.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><TextField defaultValue={contact?.fullName} label="Full name" name="fullName" placeholder="Preferred public name" state={state} /></div>
          <TextField defaultValue={contact?.firstName} label="First name" name="firstName" state={state} />
          <TextField defaultValue={contact?.lastName} label="Last name" name="lastName" state={state} />
          <TextField defaultValue={contact?.jobTitle} label="Job title" name="jobTitle" state={state} />
          <TextField defaultValue={contact?.department} label="Department" name="department" state={state} />
          <TextField defaultValue={contact?.seniority} label="Seniority" name="seniority" state={state} />
          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-800" htmlFor="contactStatus">Contact status</label>
            <select className={inputClass} defaultValue={contact?.contactStatus ?? "discovered"} id="contactStatus" name="contactStatus">
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <FieldError name="contactStatus" state={state} />
          </div>
          <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-zinc-200 px-3.5 text-sm font-semibold text-zinc-700">
            <input className="size-4 accent-[#e5222a]" defaultChecked={contact?.isPrimaryContact ?? false} name="isPrimaryContact" type="checkbox" value="true" />
            <input name="isPrimaryContact" type="hidden" value="false" />
            Primary contact
          </label>
        </div>
      </Section>

      <Section title="Public contact channels" description="Enter only publicly listed business contact details.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={contact?.workEmail} label="Work email" name="workEmail" state={state} type="email" />
          <TextField defaultValue={contact?.personalEmail} label="Public personal email" name="personalEmail" state={state} type="email" />
          <TextField defaultValue={contact?.publicPhone} label="Public phone" name="publicPhone" state={state} type="tel" />
          <TextField defaultValue={contact?.mobilePhone} label="Mobile phone" name="mobilePhone" state={state} type="tel" />
          <TextField defaultValue={contact?.whatsappPhone} label="WhatsApp phone" name="whatsappPhone" state={state} type="tel" />
        </div>
      </Section>

      <Section title="Public profiles" description="Optional public social profiles used to verify identity.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={contact?.linkedinUrl} label="LinkedIn URL" name="linkedinUrl" state={state} type="url" />
          <TextField defaultValue={contact?.facebookUrl} label="Facebook URL" name="facebookUrl" state={state} type="url" />
          <TextField defaultValue={contact?.instagramUrl} label="Instagram URL" name="instagramUrl" state={state} type="url" />
        </div>
      </Section>

      <Section title="Company and assignment" description="Company links are optional. Server authorization controls assignment and Company changes.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            defaultValue={contact?.companyId}
            disabled={mode === "edit" && !management}
            helper={mode === "edit" && !management ? "Representatives cannot change a Contact's Company." : "Leave empty for an independent Contact. Enter an accessible Company UUID."}
            label="Company ID"
            name="companyId"
            placeholder="Independent / no company"
            state={state}
          />
          <AssignmentControl actor={actor} contact={contact} mode={mode} state={state} />
        </div>
      </Section>

      <Section title="Source provenance" description="Public source evidence and discovery time are required for every Contact.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={contact?.sourceUrl} label="Source URL" name="sourceUrl" required state={state} type="url" />
          <TextField defaultValue={contact?.sourceType ?? "manual"} label="Source type" name="sourceType" placeholder="company_website" required state={state} />
          <TextField
            defaultValue={contact?.discoveredAt ?? (mode === "create" ? props.defaultDiscoveredAt : "")}
            helper="Use an ISO 8601 timestamp including timezone, for example 2026-07-14T09:00:00.000Z."
            label="Discovered at"
            name="discoveredAt"
            required
            state={state}
          />
          <TextField defaultValue={contact?.lastVerifiedAt} label="Last verified at" name="lastVerifiedAt" placeholder="Optional ISO 8601 timestamp" state={state} />
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-bold text-zinc-800" htmlFor="notes">Notes</label>
            <textarea
              aria-describedby={state.fieldErrors?.notes ? "notes-error" : undefined}
              aria-invalid={Boolean(state.fieldErrors?.notes)}
              className={`${inputClass} min-h-28 py-3`}
              defaultValue={contact?.notes ?? ""}
              id="notes"
              name="notes"
              placeholder="Public-source context or verification notes"
            />
            <FieldError name="notes" state={state} />
          </div>
        </div>
      </Section>

      <div className="sticky bottom-3 flex flex-col-reverse gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-end">
        <button
          className="min-h-11 rounded-xl px-5 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100"
          onClick={() => router.push(mode === "edit" && contact ? `/contacts/${contact.id}` : "/contacts")}
          type="button"
        >
          Cancel
        </button>
        <SubmitButton confirming={confirming} mode={mode} />
      </div>
    </form>
  );
}
