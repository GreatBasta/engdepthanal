"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/components/locale-provider";

import { signInAction, signUpAction, type AuthFormState } from "./actions";

const initialState: AuthFormState = { error: null };

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
  "dark:border-zinc-700 dark:bg-zinc-950";

const buttonClass =
  "w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white " +
  "shadow-sm transition hover:bg-indigo-500 disabled:opacity-50";

export function AuthForms({ next }: { next: string }) {
  const { t } = useI18n();
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
                ? "bg-white text-indigo-700 shadow dark:bg-zinc-950 dark:text-indigo-300"
                : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {m === "signin" ? t("auth.title") : t("auth.createAccount")}
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
            <span className="mb-1 block text-sm font-medium">
              {t("auth.name")}
            </span>
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
          <span className="mb-1 block text-sm font-medium">
            {t("auth.email")}
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {t("auth.password")}
          </span>
          <input
            name="password"
            type="password"
            required
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            minLength={mode === "signup" ? 10 : undefined}
            aria-describedby={mode === "signup" ? "password-help" : undefined}
            className={inputClass}
          />
          {mode === "signup" && (
            <span
              id="password-help"
              className="mt-1 block text-xs text-zinc-500"
            >
              {t("auth.passwordHelp")}
            </span>
          )}
        </label>

        {state.error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className={buttonClass}>
          {pending
            ? t("auth.working")
            : mode === "signin"
              ? t("auth.title")
              : t("auth.createAccount")}
        </button>
      </form>
    </div>
  );
}
