"use client";

import { useActionState } from "react";

import { completeOnboarding, type OnboardingFormState } from "./actions";

const initialState: OnboardingFormState = { error: null };

const COUNTRIES: [string, string][] = [
  ["AT", "Austria"],
  ["AU", "Australia"],
  ["BE", "Belgium"],
  ["BR", "Brazil"],
  ["CA", "Canada"],
  ["CH", "Switzerland"],
  ["CN", "China"],
  ["CZ", "Czechia"],
  ["DE", "Germany"],
  ["DK", "Denmark"],
  ["EG", "Egypt"],
  ["ES", "Spain"],
  ["FI", "Finland"],
  ["FR", "France"],
  ["GB", "United Kingdom"],
  ["GR", "Greece"],
  ["HU", "Hungary"],
  ["ID", "Indonesia"],
  ["IE", "Ireland"],
  ["IN", "India"],
  ["IR", "Iran"],
  ["IT", "Italy"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["MX", "Mexico"],
  ["MY", "Malaysia"],
  ["NG", "Nigeria"],
  ["NL", "Netherlands"],
  ["NO", "Norway"],
  ["NZ", "New Zealand"],
  ["PK", "Pakistan"],
  ["PL", "Poland"],
  ["PT", "Portugal"],
  ["RO", "Romania"],
  ["SA", "Saudi Arabia"],
  ["SE", "Sweden"],
  ["SG", "Singapore"],
  ["TR", "Türkiye"],
  ["US", "United States"],
  ["ZA", "South Africa"],
];

const THIS_YEAR = new Date().getFullYear();
const INTAKE_YEARS = [THIS_YEAR + 1, THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2];

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-zinc-500 " +
  "dark:border-zinc-700 dark:bg-zinc-900";

export function OnboardingForm({
  universities,
  programs,
}: {
  universities: { name: string; countryCode: string }[];
  programs: { slug: string; name: string }[];
}) {
  const [state, dispatch, pending] = useActionState(
    completeOnboarding,
    initialState,
  );

  return (
    <form action={dispatch} className="space-y-5">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Your university</span>
        <input
          name="universityName"
          type="text"
          required
          list="university-suggestions"
          placeholder="Start typing…"
          className={inputClass}
        />
        <datalist id="university-suggestions">
          {universities.map((u) => (
            <option key={`${u.name}|${u.countryCode}`} value={u.name}>
              {u.countryCode}
            </option>
          ))}
        </datalist>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium">Country</span>
        <select name="countryCode" required className={inputClass}>
          <option value="">Pick a country…</option>
          {COUNTRIES.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </label>

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
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-300 p-3 has-[:checked]:border-zinc-900 has-[:checked]:ring-1 has-[:checked]:ring-zinc-900 dark:border-zinc-700 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:ring-zinc-100">
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
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-300 p-3 has-[:checked]:border-zinc-900 has-[:checked]:ring-1 has-[:checked]:ring-zinc-900 dark:border-zinc-700 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:ring-zinc-100">
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
        className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Setting up…" : "Unlock the first-year database"}
      </button>
    </form>
  );
}
