export default function ContactDetailsLoading() {
  return (
    <div aria-label="Loading contact details" aria-live="polite" className="mx-auto max-w-5xl animate-pulse" role="status">
      <div className="h-4 w-32 rounded bg-zinc-200" />
      <div className="mt-4 h-10 w-72 max-w-full rounded-xl bg-zinc-200" />
      <div className="mt-3 h-4 max-w-lg rounded bg-zinc-100" />
      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="h-72 rounded-2xl border border-zinc-200 bg-zinc-100" />
        <div className="h-52 rounded-2xl border border-zinc-200 bg-zinc-100" />
      </div>
      <span className="sr-only">Loading contact details…</span>
    </div>
  );
}
