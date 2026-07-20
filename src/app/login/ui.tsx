"use client";

import { useActionState, useState } from "react";

import { signInAction, signUpAction, type AuthFormState } from "./actions";

const initialState: AuthFormState = { error: null };

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-zinc-500 " +
  "dark:border-zinc-700 dark:bg-zinc-900";

const buttonClass =
  "w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white " +
  "hover:bg-zinc-700 disabled:opacity-50 " +
  "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export function AuthForms({ next }: { next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInDispatch, signInPending] = useActionState(
    signInAction,
    initialState,
  );
  const [signUpState, signUpDispatch, signUpPending] = useActionState(
    signUpAction,
    initialState,
  );

  const state = mode === "signin" ? signInState : signUpState;
  const pending = mode === "signin" ? signInPending : signUpPending;

  return (
    <div>
      <div className="mb-6 flex rounded-lg bg-zinc-200 p-1 dark:bg-zinc-800">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${
              mode === m
                ? "bg-white shadow dark:bg-zinc-950"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form
        action={mode === "signin" ? signInDispatch : signUpDispatch}
        className="space-y-4"
      >
        <input type="hidden" name="next" value={next} />
        {mode === "signup" && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Your name</span>
            <input
              name="displayName"
              type="text"
              required
              autoComplete="name"
              className={inputClass}
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            minLength={mode === "signup" ? 8 : undefined}
            className={inputClass}
          />
        </label>

        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={buttonClass}>
          {pending
            ? "Working…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
    </div>
  );
}
