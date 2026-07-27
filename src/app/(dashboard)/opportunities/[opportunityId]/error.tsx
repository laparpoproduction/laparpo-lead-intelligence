"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function OpportunityDetailsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Opportunity detail interface failed", {
      errorName: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <section
      className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
      role="alert"
    >
      <h1 className="text-xl font-black text-zinc-950">
        Opportunity could not be loaded
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Try again. If the issue continues, contact an administrator.
      </p>
      <button
        className="mt-5 min-h-11 rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5222a] focus-visible:ring-offset-2"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
