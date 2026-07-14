"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { softDeleteContactAction } from "@/app/(dashboard)/contacts/actions";
import { initialContactFormState } from "@/app/(dashboard)/contacts/form-state";

function ArchiveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="min-h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Archiving…" : "Archive contact"}
    </button>
  );
}

export function ContactDeleteDialog({
  contactId,
  contactName,
}: {
  contactId: string;
  contactName: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [state, formAction] = useActionState(
    softDeleteContactAction,
    initialContactFormState,
  );

  useEffect(() => {
    if (state.status === "success" || state.status === "already_processed") {
      dialogRef.current?.close();
      router.replace(state.redirectTo ?? "/contacts");
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);

  return (
    <>
      <button
        className="inline-flex min-h-9 items-center rounded-lg px-3 text-xs font-bold text-red-700 transition hover:bg-red-50"
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        Archive
      </button>
      <dialog
        aria-labelledby={`archive-${contactId}-title`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/45"
        ref={dialogRef}
      >
        <form action={formAction} className="p-6">
          <input name="contactId" type="hidden" value={contactId} />
          <input name="confirm" type="hidden" value="true" />
          <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-red-50 text-xl text-red-700" aria-hidden="true">!</div>
          <h2 className="text-xl font-black" id={`archive-${contactId}-title`}>
            Archive {contactName}?
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            The contact will leave active CRM views but will not be permanently deleted.
            Only management can perform this action.
          </p>
          {state.status !== "idle" && state.status !== "success" ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="min-h-10 rounded-xl px-4 text-sm font-bold text-zinc-600 hover:bg-zinc-100"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Cancel
            </button>
            <ArchiveButton />
          </div>
        </form>
      </dialog>
    </>
  );
}
