import Link from "next/link";

export default function ContactNotFound() {
  return (
    <section className="mx-auto grid min-h-80 max-w-3xl place-items-center rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
      <div className="max-w-md">
        <p className="text-sm font-bold text-[#e5222a]">Contacts</p>
        <h2 className="mt-2 text-2xl font-black text-zinc-950">Contact not found</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">This Contact does not exist or is not available to your account.</p>
        <Link className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-800" href="/contacts">
          Back to Contacts
        </Link>
      </div>
    </section>
  );
}
