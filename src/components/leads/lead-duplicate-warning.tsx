export function LeadDuplicateWarning({
  candidateIds,
  mode,
  onRevise,
}: {
  candidateIds: string[];
  mode: "create" | "edit";
  onRevise: () => void;
}) {
  return (
    <div aria-live="assertive" className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950" role="alert" tabIndex={-1}>
      <p className="font-black">Possible duplicate lead</p>
      <p className="mt-1 text-sm leading-6">
        Matching evidence was found. Review the candidate IDs, then explicitly {mode === "create" ? "create" : "apply the update"} anyway or revise the form.
      </p>
      <ul aria-label="Duplicate candidate IDs" className="mt-3 space-y-1 text-xs font-semibold">
        {candidateIds.map((id) => <li className="break-all rounded-lg border border-amber-200 bg-white/70 px-3 py-2 font-mono" key={id}>{id}</li>)}
      </ul>
      <p className="mt-3 text-xs leading-5 text-amber-800">Editing any submitted value invalidates this confirmation token.</p>
      <button className="mt-4 min-h-10 rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold hover:bg-amber-100" onClick={onRevise} type="button">
        Revise details instead
      </button>
    </div>
  );
}
