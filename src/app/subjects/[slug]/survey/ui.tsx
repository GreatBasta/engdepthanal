"use client";

import { useMemo, useState, useTransition } from "react";

import { saveGrade } from "./actions";

// ---------------------------------------------------------------------------
// Grade step
// ---------------------------------------------------------------------------

type ScaleOption =
  | {
      id: string;
      label: string;
      kind: "numeric";
      min: number;
      max: number;
      step: number;
    }
  | { id: string; label: string; kind: "letter"; options: string[] };

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-cyan-600 " +
  "dark:border-zinc-700 dark:bg-zinc-950";

export function GradeForm({
  subjectSlug,
  nextHref,
  scales,
  existingScale,
  existingValue,
}: {
  subjectSlug: string;
  nextHref: string;
  scales: ScaleOption[];
  existingScale: string | null;
  existingValue: string | null;
}) {
  const [scaleId, setScaleId] = useState(existingScale ?? scales[0].id);
  const [value, setValue] = useState(existingValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const scale = useMemo(
    () => scales.find((s) => s.id === scaleId) ?? scales[0],
    [scales, scaleId],
  );

  function submit() {
    setError(null);
    if (!value) {
      setError("Please enter your grade.");
      return;
    }
    startTransition(async () => {
      try {
        await saveGrade({
          subjectSlug,
          scale: scaleId,
          rawValue: value,
          nextHref,
        });
      } catch (e) {
        if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT"))
          throw e;
        setError("That grade doesn't look valid for the chosen scale.");
      }
    });
  }

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold">What was your final grade?</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Only you ever see your grade. It&apos;s normalized and used only in
        aggregate, once enough students have responded.
      </p>

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Grading scale</span>
          <select
            value={scaleId}
            onChange={(e) => {
              setScaleId(e.target.value);
              setValue("");
            }}
            className={inputClass}
          >
            {scales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">Your grade</span>
          {scale.kind === "letter" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={inputClass}
            >
              <option value="">Pick…</option>
              {scale.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="number"
              inputMode="decimal"
              min={scale.min}
              max={scale.max}
              step={scale.step}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`${scale.min}–${scale.max}`}
              className={inputClass}
            />
          )}
        </label>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="w-full rounded-lg bg-cyan-800 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue to the questions →"}
        </button>
      </div>
    </div>
  );
}
