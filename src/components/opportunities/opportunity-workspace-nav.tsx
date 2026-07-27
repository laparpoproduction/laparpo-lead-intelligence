import Link from "next/link";

const baseClass =
  "inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5222a] focus-visible:ring-offset-2";

export function OpportunityWorkspaceNav({
  current,
}: {
  current: "list" | "pipeline";
}) {
  return (
    <nav
      aria-label="Opportunity workspaces"
      className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm"
    >
      <Link
        aria-current={current === "list" ? "page" : undefined}
        className={`${baseClass} ${
          current === "list"
            ? "bg-zinc-950 text-white"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
        }`}
        href="/opportunities"
      >
        Opportunities List
      </Link>
      <Link
        aria-current={current === "pipeline" ? "page" : undefined}
        className={`${baseClass} ${
          current === "pipeline"
            ? "bg-zinc-950 text-white"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
        }`}
        href="/opportunities/pipeline"
      >
        Pipeline
      </Link>
    </nav>
  );
}
