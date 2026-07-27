export default function OpportunityDetailsLoading() {
  return (
    <div
      aria-label="Loading Opportunity details"
      className="animate-pulse space-y-5"
      role="status"
    >
      <span className="sr-only">Loading Opportunity details</span>
      <div className="h-48 rounded-2xl bg-zinc-100" />
      <div className="h-64 rounded-2xl bg-zinc-100" />
      <div className="h-52 rounded-2xl bg-zinc-100" />
    </div>
  );
}
