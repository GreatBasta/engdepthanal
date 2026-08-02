"use client";

import { useActionState } from "react";

import {
  inviteMemberAction,
  type InviteMemberState,
} from "./actions";

const initialState: InviteMemberState = {
  error: null,
  message: null,
  inviteUrl: null,
};

export function InviteMemberForm({
  coursePageId,
  courseSlug,
}: {
  coursePageId: string;
  courseSlug: string;
}) {
  const [state, action, pending] = useActionState(
    inviteMemberAction,
    initialState,
  );

  return (
    <form
      action={action}
      className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <input type="hidden" name="coursePageId" value={coursePageId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <h3 className="font-semibold">Add or invite a visitor</h3>
      <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
        Visitors can contribute resources and exam information. Curriculum editing
        requires an Owner-approved co-ownership request.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
        <input
          type="email"
          name="email"
          required
          maxLength={320}
          placeholder="student@example.edu"
          aria-label="Invitee email"
          className={inputClass}
        />
        <select
          name="attendance"
          defaultValue="not_attended"
          className={inputClass}
        >
          <option value="attended">Attended</option>
          <option value="not_attended">Not attended</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p aria-live="polite" className="mt-3 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
      {state.inviteUrl ? (
        <a
          href={state.inviteUrl}
          className="mt-2 block overflow-x-auto rounded-lg border border-zinc-200 bg-white p-2 font-mono text-xs underline dark:border-zinc-700 dark:bg-zinc-900"
        >
          {state.inviteUrl}
        </a>
      ) : null}
    </form>
  );
}

const inputClass =
  "min-w-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900";
