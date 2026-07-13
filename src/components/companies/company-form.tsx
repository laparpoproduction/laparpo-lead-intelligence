"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import {
  createCompanyAction,
  updateCompanyAction,
} from "@/app/(dashboard)/companies/actions";
import { initialCompanyFormState, type CompanyFormState } from "@/app/(dashboard)/companies/form-state";
import type { Company } from "@/lib/companies/company.types";

type CompanyFormProps =
  | { mode: "create"; company?: never }
  | { mode: "edit"; company: Company };

type FieldProps = {
  label: string;
  name: string;
  state: CompanyFormState;
  defaultValue?: string | number | null;
  required?: boolean;
  type?: "email" | "number" | "tel" | "text" | "url";
  placeholder?: string;
};

const inputClass = "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3.5 text-sm text-zinc-950 shadow-sm transition placeholder:text-zinc-400 hover:border-zinc-400 focus:border-[#e5222a] focus:outline-none";

function FieldError({ name, state }: { name: string; state: CompanyFormState }) {
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
}: FieldProps) {
  const hasError = Boolean(state.fieldErrors?.[name]?.length);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-zinc-800" htmlFor={name}>
        {label}{required ? <span className="ml-1 text-[#e5222a]" aria-hidden="true">*</span> : null}
      </label>
      <input
        aria-describedby={hasError ? `${name}-error` : undefined}
        aria-invalid={hasError}
        className={inputClass}
        defaultValue={defaultValue ?? ""}
        id={name}
        min={type === "number" ? 0 : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
      <FieldError name={name} state={state} />
    </div>
  );
}

function FormFeedback({ state }: { state: CompanyFormState }) {
  if (state.status === "idle") return null;
  const duplicate = state.status === "duplicate_warning";
  const success = state.status === "success";
  const styles = success
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : duplicate
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-red-200 bg-red-50 text-red-900";
  return (
    <div aria-live="polite" className={`rounded-xl border p-4 text-sm ${styles}`} role={success ? "status" : "alert"}>
      <p className="font-bold">{duplicate ? "Possible duplicate found" : success ? "Saved" : "Unable to save"}</p>
      {state.message ? <p className="mt-1 leading-5 opacity-80">{state.message}</p> : null}
      {duplicate ? (
        <p className="mt-2 text-xs font-medium">
          {state.duplicateCandidateIds?.length ?? 0} matching record(s) require confirmation.
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton({ mode, confirming }: { mode: "create" | "edit"; confirming: boolean }) {
  const { pending } = useFormStatus();
  const label = confirming
    ? mode === "create" ? "Create anyway" : "Save anyway"
    : mode === "create" ? "Create company" : "Save changes";
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

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
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

export function CompanyForm({ mode, company }: CompanyFormProps) {
  const router = useRouter();
  const action = mode === "create" ? createCompanyAction : updateCompanyAction;
  const [state, formAction] = useActionState(action, initialCompanyFormState);

  useEffect(() => {
    if (state.status === "success" && mode === "create") {
      router.replace("/companies");
      router.refresh();
    }
  }, [mode, router, state.status]);

  const confirming = state.status === "duplicate_warning" && Boolean(state.confirmationToken);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {mode === "edit" ? <input name="companyId" type="hidden" value={company.id} /> : null}
      {confirming ? <input name="confirmationToken" type="hidden" value={state.confirmationToken} /> : null}
      <FormFeedback state={state} />

      <Section title="Company profile" description="The official and public-facing identity used throughout the CRM.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={company?.displayName} label="Display name" name="displayName" required state={state} />
          <TextField defaultValue={company?.legalName} label="Legal name" name="legalName" required state={state} />
          <div>
            <label className="mb-1.5 block text-sm font-bold text-zinc-800" htmlFor="companyType">Company type<span className="ml-1 text-[#e5222a]" aria-hidden="true">*</span></label>
            <select aria-invalid={Boolean(state.fieldErrors?.companyType)} className={inputClass} defaultValue={company?.companyType ?? ""} id="companyType" name="companyType" required>
              <option disabled value="">Select type</option>
              <option value="fnb">F&amp;B</option>
              <option value="agency">Agency</option>
              <option value="hotel">Hotel</option>
              <option value="other">Other</option>
            </select>
            <FieldError name="companyType" state={state} />
          </div>
          <TextField defaultValue={company?.industry} label="Industry" name="industry" placeholder="e.g. Food & Beverage" state={state} />
          <TextField defaultValue={company?.estimatedBranchCount} label="Estimated branches" name="estimatedBranchCount" state={state} type="number" />
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-sm font-bold text-zinc-800" htmlFor="description">Description</label>
            <textarea className={`${inputClass} min-h-28 py-3`} defaultValue={company?.description ?? ""} id="description" name="description" placeholder="Short public business description" />
            <FieldError name="description" state={state} />
          </div>
        </div>
      </Section>

      <Section title="Public contact" description="Only enter business contact information that is publicly listed.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={company?.publicPhone} label="Public phone" name="publicPhone" placeholder="04-123 4567" state={state} type="tel" />
          <TextField defaultValue={company?.publicEmail} label="Public email" name="publicEmail" placeholder="hello@company.com" state={state} type="email" />
          <div className="sm:col-span-2"><TextField defaultValue={company?.websiteUrl} label="Website URL" name="websiteUrl" placeholder="https://company.com" state={state} type="url" /></div>
        </div>
      </Section>

      <Section title="Location" description="Use the main business address or headquarters for this record.">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><TextField defaultValue={company?.addressLine1} label="Address line 1" name="addressLine1" state={state} /></div>
          <div className="sm:col-span-2"><TextField defaultValue={company?.addressLine2} label="Address line 2" name="addressLine2" state={state} /></div>
          <TextField defaultValue={company?.city} label="City" name="city" state={state} />
          <TextField defaultValue={company?.state} label="State" name="state" state={state} />
          <TextField defaultValue={company?.postcode} label="Postcode" name="postcode" state={state} />
          <TextField defaultValue={company?.country ?? "MY"} label="Country code" name="country" placeholder="MY" state={state} />
        </div>
      </Section>

      <Section title="Social profiles" description="Optional public channels used to verify the company and its content activity.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={company?.facebookUrl} label="Facebook URL" name="facebookUrl" state={state} type="url" />
          <TextField defaultValue={company?.instagramUrl} label="Instagram URL" name="instagramUrl" state={state} type="url" />
          <TextField defaultValue={company?.tiktokUrl} label="TikTok URL" name="tiktokUrl" state={state} type="url" />
          <TextField defaultValue={company?.youtubeUrl} label="YouTube URL" name="youtubeUrl" state={state} type="url" />
          <div className="sm:col-span-2"><TextField defaultValue={company?.googleMapsUrl} label="Google Maps URL" name="googleMapsUrl" state={state} type="url" /></div>
        </div>
      </Section>

      <Section title="Source provenance" description="Every company record must retain the public source used to verify it.">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField defaultValue={company?.sourceUrl} label="Source URL" name="sourceUrl" required state={state} type="url" />
          <TextField defaultValue={company?.sourceType ?? "manual"} label="Source type" name="sourceType" placeholder="company_website" required state={state} />
        </div>
      </Section>

      <div className="sticky bottom-3 flex flex-col-reverse gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-end">
        <button className="min-h-11 rounded-xl px-5 text-sm font-bold text-zinc-600 transition hover:bg-zinc-100" onClick={() => router.push("/companies")} type="button">Cancel</button>
        <SubmitButton confirming={confirming} mode={mode} />
      </div>
    </form>
  );
}
