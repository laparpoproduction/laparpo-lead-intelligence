"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label className="mb-2 block text-sm font-bold text-zinc-700" htmlFor="email">Work email</label>
        <input autoComplete="email" className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm placeholder:text-zinc-400" id="email" name="email" placeholder="you@laparpo.com" required type="email" />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-bold text-zinc-700" htmlFor="password">Password</label>
          <span className="text-xs text-zinc-400">Minimum 8 characters</span>
        </div>
        <input autoComplete="current-password" className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-950 shadow-sm" id="password" minLength={8} name="password" required type="password" />
      </div>
      {state.error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800" role="alert">{state.error}</p>}
      <button className="h-11 w-full rounded-xl bg-[#e5222a] text-sm font-bold text-white shadow-[0_8px_22px_rgba(229,34,42,.22)] transition hover:bg-[#c71920] disabled:cursor-wait disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
