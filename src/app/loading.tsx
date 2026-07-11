export default function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-zinc-50" role="status" aria-label="Loading dashboard">
      <div className="flex items-center gap-3 text-sm font-semibold text-zinc-500">
        <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-[#e5222a]" />
        Loading lead intelligence…
      </div>
    </div>
  );
}
