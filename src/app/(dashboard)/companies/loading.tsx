export default function CompaniesLoading() {
  return (
    <div aria-label="Loading companies" aria-live="polite" className="animate-pulse" role="status">
      <div className="h-4 w-20 rounded bg-zinc-200" />
      <div className="mt-3 h-10 w-64 rounded-xl bg-zinc-200" />
      <div className="mt-3 h-4 max-w-xl rounded bg-zinc-200" />
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div className="h-11 rounded-xl bg-zinc-100" key={index} />
          ))}
        </div>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="h-12 border-b border-zinc-200 bg-zinc-100" />
        {Array.from({ length: 5 }, (_, index) => (
          <div className="grid grid-cols-4 gap-5 border-b border-zinc-100 p-5 last:border-b-0" key={index}>
            <div className="h-5 rounded bg-zinc-200" />
            <div className="h-5 rounded bg-zinc-100" />
            <div className="h-5 rounded bg-zinc-100" />
            <div className="h-5 rounded bg-zinc-100" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading companies…</span>
    </div>
  );
}
