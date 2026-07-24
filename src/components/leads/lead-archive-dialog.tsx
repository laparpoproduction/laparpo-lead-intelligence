"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { archiveLeadAction } from "@/app/(dashboard)/leads/actions";
import { initialLeadFormState } from "@/app/(dashboard)/leads/form-state";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return <button className="min-h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Archiving…" : "Archive lead"}</button>;
}
export function LeadArchiveDialog({ leadId, title }: { leadId: string; title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, formAction] = useActionState(archiveLeadAction, initialLeadFormState);

  useEffect(() => {
    if (state.status === "success" || state.status === "already_processed") {
      dialogRef.current?.close();
      router.replace(state.redirectTo ?? "/leads");
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <>
      <button className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold text-red-700 hover:bg-red-50" onClick={() => dialogRef.current?.showModal()} type="button">Archive</button>
      <dialog aria-labelledby={`archive-${leadId}-title`} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/45" ref={dialogRef}>
        <form action={formAction} className="p-6">
          <input name="leadId" type="hidden" value={leadId} />
          <input name="confirm" type="hidden" value="true" />
          <h2 className="text-xl font-black" id={`archive-${leadId}-title`}>Archive {title}?</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">This removes the lead from active CRM views without permanently deleting it.</p>
          {state.status !== "idle" && state.status !== "success" ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">{state.message}</p> : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="min-h-10 rounded-xl px-4 text-sm font-bold text-zinc-600 hover:bg-zinc-100" onClick={() => dialogRef.current?.close()} type="button">Cancel</button>
            <ConfirmButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
