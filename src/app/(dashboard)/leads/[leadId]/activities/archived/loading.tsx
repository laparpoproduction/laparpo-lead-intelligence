export default function ArchivedActivitiesLoading() {
  return (
    <div
      aria-label="Loading archived activities"
      aria-live="polite"
      className="animate-pulse space-y-4"
      role="status"
    >
      <div className="h-20 rounded-2xl bg-zinc-100" />
      <div className="h-24 rounded-2xl bg-zinc-100" />
      <div className="ml-8 h-48 rounded-2xl bg-zinc-100" />
      <span className="sr-only">Loading archived activity timeline</span>
    </div>
  );
}
