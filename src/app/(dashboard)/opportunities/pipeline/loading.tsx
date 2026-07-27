export default function OpportunityPipelineLoading() {
  return (
    <div
      aria-label="Loading Opportunity pipeline"
      className="animate-pulse space-y-5"
      role="status"
    >
      <span className="sr-only">Loading Opportunity pipeline</span>
      <div className="h-24 rounded-2xl bg-zinc-100" />
      <div className="h-32 rounded-2xl bg-zinc-100" />
      <div className="grid auto-cols-[19rem] grid-flow-col gap-4 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="h-96 rounded-2xl bg-zinc-100" key={index} />
        ))}
      </div>
    </div>
  );
}
