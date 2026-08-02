"use client";

import { useActionState } from "react";

import { OrganizationCombobox } from "@/components/organization-combobox";
import { completeOnboarding, type OnboardingFormState } from "./actions";

const initialState: OnboardingFormState = { error: null };

const THIS_YEAR = new Date().getFullYear();
const INTAKE_YEARS = [THIS_YEAR + 1, THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2];

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500 " +
  "dark:border-zinc-700 dark:bg-zinc-950";

export function OnboardingForm({
  programs,
}: {
  programs: { slug: string; name: string }[];
}) {
  const [state, dispatch, pending] = useActionState(
    completeOnboarding,
    initialState,
  );

  return (
    <form action={dispatch} className="space-y-5">
      <OrganizationCombobox label="Your university" />

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Your course (engineering discipline)
        </span>
        <select name="programSlug" required className={inputClass}>
          <option value="">Pick your course…</option>
          {programs.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          First-year intake
        </span>
        <select
          name="intakeYear"
          required
          defaultValue={THIS_YEAR}
          className={inputClass}
        >
          {INTAKE_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium">
          Are you starting first year, or actively attending it?
        </legend>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-300 p-3 transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500 dark:border-zinc-700 dark:has-[:checked]:bg-indigo-950/30">
            <input
              type="radio"
              name="phase"
              value="starting"
              required
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">
                I&apos;m starting
              </span>
              <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                Get the full outlook of every topic and subtopic you&apos;ll
                need to learn, and how deep each one goes.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-300 p-3 transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50/50 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500 dark:border-zinc-700 dark:has-[:checked]:bg-indigo-950/30">
            <input
              type="radio"
              name="phase"
              value="attending"
              required
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">
                I&apos;m actively attending
              </span>
              <span className="block text-xs text-zinc-600 dark:text-zinc-400">
                Track what you&apos;ve covered — and when you finish a subject,
                help map what your university really teaches.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {pending ? "Setting up…" : "Unlock the first-year database"}
      </button>
    </form>
  );
}
