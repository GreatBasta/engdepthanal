import Link from "next/link";
import { redirect } from "next/navigation";

import { currentStudentId } from "@/auth";

export default async function Home() {
  const studentId = await currentStudentId();
  if (studentId) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300">
        First-year engineering · starting with Calculus &amp; Linear Algebra
      </span>

      <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
        Know exactly what{" "}
        <span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">
          to learn
        </span>
        .
      </h1>

      <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
        See every topic and subtopic you need for first year — and how deep to
        go on each. Track what you&apos;ve covered, and discover what your
        university <em>won&apos;t</em> teach you, from students who finished
        before you.
      </p>

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Get started — it&apos;s free
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          I already have an account
        </Link>
      </div>

      <dl className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
        {[
          {
            t: "A clear map",
            d: "Every subtopic, tagged with how deeply you need to learn it.",
          },
          {
            t: "Your progress",
            d: "Tick off what you've covered as you go through the year.",
          },
          {
            t: "The real gaps",
            d: "See what your university skips — from those who finished it.",
          },
        ].map((f) => (
          <div
            key={f.t}
            className="rounded-xl border border-zinc-200 bg-white/70 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <dt className="text-sm font-semibold">{f.t}</dt>
            <dd className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {f.d}
            </dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
