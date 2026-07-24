"use client";

import { useMemo, useState, useTransition } from "react";

import { addNote, applyAnswers, finishSurvey, saveGrade } from "./actions";

type Answer = "yes_depth" | "yes_brief" | "no" | "unsure";

export interface CaptureSubtopic {
  id: string;
  name: string;
  description: string | null;
  answer: Answer | null;
}
export interface CaptureTopic {
  id: string;
  position: number;
  name: string;
  subtopics: CaptureSubtopic[];
}

// One place for every per-answer class string (Tailwind needs them static).
const INK: Record<
  Answer,
  {
    label: string;
    dot: string;
    swatch: string;
    tag: string;
    penActive: string;
    nib: string;
  }
> = {
  yes_depth: {
    label: "In depth",
    dot: "bg-emerald-500",
    swatch: "bg-emerald-500 border-emerald-500",
    tag: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    penActive: "border-emerald-500 ring-2 ring-emerald-500",
    nib: "bg-emerald-500",
  },
  yes_brief: {
    label: "Briefly",
    dot: "bg-amber-500",
    swatch: "bg-amber-500 border-amber-500",
    tag: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    penActive: "border-amber-500 ring-2 ring-amber-500",
    nib: "bg-amber-500",
  },
  no: {
    label: "Not covered",
    dot: "bg-rose-500",
    swatch: "bg-rose-500 border-rose-500",
    tag: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    penActive: "border-rose-500 ring-2 ring-rose-500",
    nib: "bg-rose-500",
  },
  unsure: {
    label: "Not sure",
    dot: "bg-slate-400",
    swatch: "bg-slate-400 border-slate-400",
    tag: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    penActive: "border-slate-400 ring-2 ring-slate-400",
    nib: "bg-slate-400",
  },
};
const PENS: Answer[] = ["yes_depth", "yes_brief", "no", "unsure"];

const CHECK = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-3.5 w-3.5 text-white"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// ---------------------------------------------------------------------------
// The highlighter capture — one page for the whole subject
// ---------------------------------------------------------------------------

export function CaptureForm({
  subjectSlug,
  subjectName,
  topics,
  gradeHref,
}: {
  subjectSlug: string;
  subjectName: string;
  topics: CaptureTopic[];
  gradeHref: string;
}) {
  const initial = useMemo(() => {
    const m: Record<string, Answer> = {};
    for (const t of topics)
      for (const s of t.subtopics) if (s.answer) m[s.id] = s.answer;
    return m;
  }, [topics]);

  const [marks, setMarks] = useState<Record<string, Answer>>(initial);
  const [pen, setPen] = useState<Answer | null>(null);
  const [, startTransition] = useTransition();

  function persist(entries: { subtopicId: string; answer: Answer | null }[]) {
    if (entries.length === 0) return;
    startTransition(() => {
      void applyAnswers({ subjectSlug, entries });
    });
  }

  function tapRow(id: string) {
    if (!pen) return;
    setMarks((prev) => {
      const next = { ...prev };
      if (next[id] === pen) {
        delete next[id];
        persist([{ subtopicId: id, answer: null }]);
      } else {
        next[id] = pen;
        persist([{ subtopicId: id, answer: pen }]);
      }
      return next;
    });
  }

  function fill(ids: string[]) {
    if (!pen) return;
    const empty = ids.filter((id) => !marks[id]);
    if (empty.length === 0) return;
    setMarks((prev) => {
      const next = { ...prev };
      for (const id of empty) next[id] = pen;
      return next;
    });
    persist(empty.map((id) => ({ subtopicId: id, answer: pen })));
  }

  const allIds = topics.flatMap((t) => t.subtopics.map((s) => s.id));
  const answeredCount = allIds.filter((id) => marks[id]).length;
  const blankCount = allIds.length - answeredCount;
  const counts = PENS.map(
    (p) => allIds.filter((id) => marks[id] === p).length,
  );

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-lg px-4 pb-40 pt-8">
        <a
          href={gradeHref}
          className="text-xs text-zinc-500 underline-offset-4 hover:underline"
        >
          ← Grade
        </a>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
          Coverage survey · you finished this
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-balance">
          Mark what {subjectName} actually covered at your university.
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Pick a highlighter, then tap the topics you studied that way. Nothing
          is filled in for you — a blank row just means you skipped it.
        </p>

        {/* Highlighter tray */}
        <div className="sticky top-0 z-20 -mx-4 mt-5 border-b border-zinc-200 bg-zinc-50/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Your highlighter
          </p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {PENS.map((p) => {
              const active = pen === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPen(active ? null : p)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border bg-white px-1 py-2.5 transition active:scale-95 dark:bg-zinc-900 ${
                    active
                      ? INK[p].penActive
                      : "border-zinc-200 dark:border-zinc-700"
                  }`}
                >
                  <span
                    className={`h-3.5 w-6 rounded-sm ${INK[p].nib}`}
                    aria-hidden
                  />
                  <span className="text-[11px] font-semibold leading-none">
                    {INK[p].label}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-xs text-zinc-500">
            {pen ? (
              <>
                Now tap the topics your course covered{" "}
                <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                  {INK[pen].label.toLowerCase()}
                </span>
                . Switch highlighter any time.
              </>
            ) : (
              <>
                Tap a highlighter to start, then tap the rows it applies to. Tap
                a marked row again to clear it.
              </>
            )}
          </p>
        </div>

        {/* Topics */}
        <div className="mt-4 space-y-4">
          {topics.map((t) => {
            const ids = t.subtopics.map((s) => s.id);
            const done = ids.filter((id) => marks[id]).length;
            const hasBlank = done < ids.length;
            return (
              <section
                key={t.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-baseline gap-2.5 px-4 pb-2 pt-4">
                  <span className="text-xs font-bold tabular-nums text-cyan-700 dark:text-cyan-400">
                    {t.position}
                  </span>
                  <h2 className="flex-1 text-[15px] font-semibold tracking-tight">
                    {t.name}
                  </h2>
                  <span className="text-[11px] tabular-nums text-zinc-500">
                    {done}/{ids.length}
                  </span>
                </div>
                <div className="mx-4 h-[3px] overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-cyan-700 transition-all"
                    style={{ width: `${(100 * done) / ids.length}%` }}
                  />
                </div>
                <ul className="mt-2">
                  {t.subtopics.map((s) => {
                    const v = marks[s.id];
                    return (
                      <li
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => tapRow(s.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            tapRow(s.id);
                          }
                        }}
                        className="flex cursor-pointer select-none items-center gap-3 border-t border-zinc-100 px-4 py-3 first:border-t-0 active:bg-zinc-50 dark:border-zinc-800/60 dark:active:bg-zinc-800/40"
                      >
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition ${
                            v
                              ? INK[v].swatch
                              : "border-zinc-300 dark:border-zinc-600"
                          }`}
                        >
                          {v ? CHECK : null}
                        </span>
                        <span className="flex-1 text-[13.5px] leading-snug">
                          {s.name}
                        </span>
                        {v && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${INK[v].tag}`}
                          >
                            {INK[v].label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {pen && hasBlank && (
                  <button
                    type="button"
                    onClick={() => fill(ids)}
                    className="m-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-semibold text-zinc-500 transition hover:border-cyan-600 hover:text-cyan-700 dark:border-zinc-700"
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-sm ${INK[pen].dot}`}
                      aria-hidden
                    />
                    Fill the rest of this topic — {INK[pen].label.toLowerCase()}
                  </button>
                )}
              </section>
            );
          })}
        </div>

        <NoteBox subjectSlug={subjectSlug} />
      </main>

      {/* Sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-zinc-50/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-lg flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
            {PENS.map((p, i) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 text-zinc-500"
              >
                <i className={`h-2.5 w-2.5 rounded-sm ${INK[p].dot}`} />
                {counts[i]}
              </span>
            ))}
            <span className="ml-auto text-zinc-500">{blankCount} left blank</span>
          </div>
          <div className="flex gap-2.5">
            <button
              type="button"
              disabled={!pen || blankCount === 0}
              onClick={() => fill(allIds)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-[13px] font-semibold text-zinc-700 transition hover:border-cyan-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {pen && (
                <span
                  className={`h-2.5 w-2.5 rounded-sm ${INK[pen].dot}`}
                  aria-hidden
                />
              )}
              Fill all empty
            </button>
            <FinishButton
              subjectSlug={subjectSlug}
              disabled={answeredCount === 0}
              answeredCount={answeredCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FinishButton({
  subjectSlug,
  disabled,
  answeredCount,
}: {
  subjectSlug: string;
  disabled: boolean;
  answeredCount: number;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => startTransition(() => finishSurvey(subjectSlug))}
      className="rounded-xl bg-cyan-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-40"
    >
      {pending ? "Saving…" : disabled ? "Finish" : `Finish · ${answeredCount}`}
    </button>
  );
}

function NoteBox({ subjectSlug }: { subjectSlug: string }) {
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (saved) {
    return (
      <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        Thanks — your note was added. ✓
      </p>
    );
  }
  return (
    <div className="mt-6">
      <label className="block text-xs font-semibold text-zinc-500">
        Anything your course covered that isn&apos;t listed? (optional)
      </label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="e.g. we spent weeks on numerical methods…"
        className="mt-1.5 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {body.trim() && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await addNote({ subjectSlug, body: body.trim() });
              setSaved(true);
            })
          }
          className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Add note
        </button>
      )}
    </div>
  );
}

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
