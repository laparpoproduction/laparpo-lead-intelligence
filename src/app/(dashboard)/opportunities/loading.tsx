export default function OpportunitiesLoading() {
  return (
    <div
      aria-label="Loading opportunities"
      className="animate-pulse space-y-5"
      role="status"
    >
      <span className="sr-only">Loading opportunities</span>
      <div className="h-24 rounded-2xl bg-zinc-100" />
      <div className="h-32 rounded-2xl bg-zinc-100" />
      <div className="h-80 rounded-2xl bg-zinc-100" />
    </div>
  );
}
