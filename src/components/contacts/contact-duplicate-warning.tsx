type ContactDuplicateWarningProps = {
  candidateIds: string[];
  mode: "create" | "edit";
  onRevise: () => void;
};

export function ContactDuplicateWarning({
  candidateIds,
  mode,
  onRevise,
}: ContactDuplicateWarningProps) {
  return (
    <div
      aria-live="assertive"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950"
      role="alert"
      tabIndex={-1}
    >
      <p className="font-black">Possible duplicate contact</p>
      <p className="mt-1 text-sm leading-6">
        A likely matching record was found. Review the IDs below, then explicitly
        {mode === "create" ? " create" : " apply the update"} anyway or revise the form.
      </p>
      <ul className="mt-3 space-y-1 text-xs font-semibold" aria-label="Duplicate candidate IDs">
        {candidateIds.map((candidateId) => (
          <li className="break-all rounded-lg border border-amber-200 bg-white/70 px-3 py-2 font-mono" key={candidateId}>
            {candidateId}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5 text-amber-800">
        Only record IDs are shown. Editing any value invalidates this confirmation for safety.
      </p>
      <button
        className="mt-4 min-h-10 rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold transition hover:bg-amber-100"
        onClick={onRevise}
        type="button"
      >
        Revise details instead
      </button>
    </div>
  );
}
