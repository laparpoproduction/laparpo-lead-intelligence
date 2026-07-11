export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3" aria-label="Laparpo Lead Intelligence">
      <div className="grid size-9 place-items-center rounded-xl bg-[#e5222a] text-lg font-black text-white shadow-[0_8px_22px_rgba(229,34,42,.24)]">
        L
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-tight text-zinc-950">Laparpo</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Lead Intelligence
          </p>
        </div>
      )}
    </div>
  );
}
