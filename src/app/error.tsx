"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 p-6">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-bold text-[#e5222a]">Something went wrong</p>
        <h1 className="mt-2 text-xl font-black text-zinc-950">The dashboard could not be loaded.</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">Try again. If the problem continues, check the server logs using the error reference.</p>
        {error.digest && <p className="mt-3 font-mono text-xs text-zinc-400">Reference: {error.digest}</p>}
        <button className="mt-6 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-bold text-white" onClick={reset} type="button">Try again</button>
      </div>
    </main>
  );
}
