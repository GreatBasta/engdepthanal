"use client";

import { useTransition } from "react";

import {
  reviewSuggestion,
  reviewUniversity,
  reviewUniversityProgram,
} from "./actions";

type Kind = "suggestion" | "university" | "program";

const ACTIONS: Record<
  Kind,
  (input: unknown, verified: boolean) => Promise<void>
> = {
  suggestion: reviewSuggestion,
  university: reviewUniversity,
  program: reviewUniversityProgram,
};

/**
 * Accept / dismiss controls for a single review item. Optimistic-free: the
 * server action revalidates the list, so the row simply disappears once
 * handled.
 */
export function ReviewButtons({
  kind,
  id,
  acceptLabel = "Accept",
  rejectLabel = "Dismiss",
}: {
  kind: Kind;
  id: string;
  acceptLabel?: string;
  rejectLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const act = ACTIONS[kind];

  return (
    <div className="flex shrink-0 gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => act({ id }, true))}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {acceptLabel}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => act({ id }, false))}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium transition hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {rejectLabel}
      </button>
    </div>
  );
}
