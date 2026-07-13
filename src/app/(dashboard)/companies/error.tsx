"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function CompaniesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Companies interface failed", {
      errorName: error.name,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="grid min-h-80 place-items-center rounded-2xl border border-red-200 bg-red-50 p-8 text-center" role="alert">
      <div className="max-w-md">
        <div className="mx-auto mb-4 grid size-11 place-items-center rounded-2xl bg-white text-xl font-black text-red-700 shadow-sm" aria-hidden="true">!</div>
        <h2 className="text-xl font-black text-zinc-950">Companies could not be loaded</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">A temporary error prevented this CRM view from loading. No company data was changed.</p>
        <button className="mt-5 min-h-11 rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-800" onClick={reset} type="button">Try again</button>
      </div>
    </div>
  );
}
