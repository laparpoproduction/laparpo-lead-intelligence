export default function LeadDetailsLoading() {
  return (
    <div
      aria-label="Loading lead and activity timeline"
      aria-live="polite"
      className="animate-pulse space-y-5"
      role="status"
    >
      <div className="h-20 rounded-2xl bg-zinc-100" />
      <div className="h-72 rounded-2xl bg-zinc-100" />
      <div className="h-20 rounded-2xl bg-zinc-100" />
      <div className="space-y-3 pl-8">
        <div className="h-48 rounded-2xl bg-zinc-100" />
        <div className="h-48 rounded-2xl bg-zinc-100" />
      </div>
      <span className="sr-only">Loading activity timeline</span>
    </div>
  );
}
