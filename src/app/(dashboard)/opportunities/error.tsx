"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";

export default function OpportunitiesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error("Opportunities interface failed", {
      errorName: error.name,
      digest: error.digest,
    });
  }, [error]);
  return (
    <section
      className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm"
      role="alert"
    >
      <h2 className="text-xl font-black text-zinc-950">
        Opportunities could not be loaded
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Try again. If the issue continues, contact an administrator.
      </p>
      <button
        className="mt-5 min-h-11 rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </section>
  );
}
