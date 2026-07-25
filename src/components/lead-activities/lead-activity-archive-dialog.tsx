"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { archiveLeadActivityAction } from "@/app/(dashboard)/leads/activities/actions";
import { initialLeadActivityFormState } from "@/app/(dashboard)/leads/activities/form-state";

function ArchiveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Archiving activity…" : "Archive activity"}
    </button>
  );
}

export function LeadActivityArchiveDialog({
  activityId,
  subject,
}: {
  activityId: string;
  subject: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    archiveLeadActivityAction,
    initialLeadActivityFormState,
  );

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open]);

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <>
      <button
        className="inline-flex min-h-10 items-center justify-center rounded-lg px-3.5 text-sm font-bold text-red-700 hover:bg-red-50"
        onClick={() => setOpen(true)}
        type="button"
      >
        Archive activity
      </button>
      {open ? <dialog
        aria-labelledby={`archive-activity-${activityId}`}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/45"
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <form action={formAction} className="p-6">
          <input name="activityId" type="hidden" value={activityId} />
          <input name="confirm" type="hidden" value="true" />
          <h2
            className="text-xl font-black"
            id={`archive-activity-${activityId}`}
          >
            Archive this activity?
          </h2>
          <p className="mt-2 break-words text-sm font-semibold text-zinc-800">
            {subject}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">
            It will leave the active timeline without being permanently
            deleted. Management can restore it later.
          </p>
          {state.status !== "idle" && state.status !== "success" ? (
            <p
              className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800"
              role="alert"
            >
              {state.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="min-h-11 rounded-xl px-4 text-sm font-bold text-zinc-600 hover:bg-zinc-100"
              onClick={() => {
                dialogRef.current?.close();
                setOpen(false);
              }}
              type="button"
            >
              Cancel
            </button>
            <ArchiveButton />
          </div>
        </form>
      </dialog> : null}
    </>
  );
}
