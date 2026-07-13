"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { softDeleteCompanyAction } from "@/app/(dashboard)/companies/actions";
import { initialCompanyFormState } from "@/app/(dashboard)/companies/form-state";

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <button className="min-h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60" disabled={pending} type="submit">
      {pending ? "Deleting…" : "Delete company"}
    </button>
  );
}

export function CompanyDeleteDialog({ companyId, companyName }: { companyId: string; companyName: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, formAction] = useActionState(softDeleteCompanyAction, initialCompanyFormState);

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.close();
      router.replace("/companies");
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <>
      <button className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold text-red-700 transition hover:bg-red-50" onClick={() => dialogRef.current?.showModal()} type="button">
        Delete
      </button>
      <dialog aria-labelledby={`delete-${companyId}-title`} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/45" ref={dialogRef}>
        <form action={formAction} className="p-6">
          <input name="companyId" type="hidden" value={companyId} />
          <input name="confirm" type="hidden" value="true" />
          <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-red-50 text-xl text-red-700" aria-hidden="true">!</div>
          <h2 className="text-xl font-black" id={`delete-${companyId}-title`}>Delete {companyName}?</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">This removes the company from active CRM views. The record remains soft-deleted for management controls and audit safety.</p>
          {state.status !== "idle" && state.status !== "success" ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">{state.message}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-zinc-600 hover:bg-zinc-100" onClick={() => dialogRef.current?.close()} type="button">Cancel</button>
            <DeleteButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
