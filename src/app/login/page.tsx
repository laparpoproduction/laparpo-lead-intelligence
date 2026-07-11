import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_.9fr]">
      <section className="hidden overflow-hidden bg-zinc-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <BrandMark />
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-red-400">Laparpo Production</p>
          <h1 className="text-5xl font-black leading-[1.04] tracking-[-0.045em]">The next deposit starts with the right lead.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-zinc-400">Discover credible public business opportunities, understand their marketing signals and keep every sales action moving.</p>
        </div>
        <p className="text-xs text-zinc-600">Public business information only · Evidence-backed lead intelligence</p>
      </section>
      <section className="grid place-items-center p-6 sm:p-10">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-[0_24px_80px_rgba(24,24,27,.08)] sm:p-10">
          <div className="lg:hidden"><BrandMark /></div>
          <p className="mt-8 text-sm font-bold text-[#e5222a] lg:mt-0">Welcome back</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-zinc-950">Sign in to your workspace</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-500">Use the account issued to your Laparpo sales team.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
