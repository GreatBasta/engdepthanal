"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-black">Something went wrong</h1>
      <p className="mt-3 text-slate-600">
        Your data was not intentionally changed. Try the request again.
      </p>
      <button onClick={reset} className="mt-6 min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white">
        Try again
      </button>
    </main>
  );
}
