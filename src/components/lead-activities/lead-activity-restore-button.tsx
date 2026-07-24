"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { restoreLeadActivityAction } from "@/app/(dashboard)/leads/activities/actions";
import { initialLeadActivityFormState } from "@/app/(dashboard)/leads/activities/form-state";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="min-h-10 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 text-sm font-bold text-emerald-800 disabled:cursor-wait disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Restoring activity…" : "Restore activity"}
    </button>
  );
}
export function LeadActivityRestoreButton({
  activityId,
}: {
  activityId: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    restoreLeadActivityAction,
    initialLeadActivityFormState,
  );
  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [router, state.status]);
  return (
    <form action={formAction}>
      <input name="activityId" type="hidden" value={activityId} />
      <input name="confirm" type="hidden" value="true" />
      <Submit />
      {state.status !== "idle" && state.status !== "success" ? (
        <p className="mt-2 text-xs font-medium text-red-700" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
