"use client";

import { useActionState } from "react";

import { adminLogin, type AdminLoginState } from "./actions";

const initial: AdminLoginState = { error: null };

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-cyan-600 " +
  "dark:border-zinc-700 dark:bg-zinc-950";

export function AdminLoginForm() {
  const [state, dispatch, pending] = useActionState(adminLogin, initial);

  return (
    <form action={dispatch} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Username</span>
        <input
          name="username"
          type="text"
          required
          autoComplete="username"
          autoFocus
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </label>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-cyan-800 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
