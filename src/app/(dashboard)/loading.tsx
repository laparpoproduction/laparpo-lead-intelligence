export default function DashboardLoading() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading dashboard module">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-zinc-200" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="h-32 animate-pulse rounded-2xl bg-zinc-200/70" key={index} />
        ))}
      </div>
    </div>
  );
}

