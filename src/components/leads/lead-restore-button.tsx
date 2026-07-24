"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { restoreLeadAction } from "@/app/(dashboard)/leads/actions";
import { initialLeadFormState } from "@/app/(dashboard)/leads/form-state";

function Submit() {
  const { pending } = useFormStatus();
  return <button className="min-h-9 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 disabled:opacity-60" disabled={pending} type="submit">{pending ? "Restoring…" : "Restore"}</button>;
}
export function LeadRestoreButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState(restoreLeadAction, initialLeadFormState);
  useEffect(() => {
    if (state.status === "success" || state.status === "already_processed") {
      router.replace(state.redirectTo ?? "/leads");
      router.refresh();
    }
  }, [router, state.redirectTo, state.status]);
  return (
    <form action={formAction}>
      <input name="leadId" type="hidden" value={leadId} />
      <input name="confirm" type="hidden" value="true" />
      <Submit />
      {state.status !== "idle" && state.status !== "success" ? <p className="mt-1 text-xs text-red-700" role="alert">{state.message}</p> : null}
    </form>
  );
}
