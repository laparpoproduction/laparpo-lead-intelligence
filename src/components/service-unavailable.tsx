import { BrandMark } from "@/components/brand-mark";

export function ServiceUnavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 p-6">
      <section
        aria-labelledby="service-unavailable-title"
        className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(24,24,27,.08)] sm:p-12"
      >
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <p className="mt-10 text-sm font-bold uppercase tracking-[0.16em] text-[#e5222a]">
          Service unavailable
        </p>
        <h1
          className="mt-3 text-3xl font-black tracking-[-0.035em] text-zinc-950"
          id="service-unavailable-title"
        >
          The service is temporarily unavailable
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-zinc-500">
          Please try again later. No account or workspace changes can be made
          while the service is unavailable.
        </p>
      </section>
    </main>
  );
}
