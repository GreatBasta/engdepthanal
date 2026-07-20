import Link from "next/link";
import { redirect } from "next/navigation";

import { currentStudentId } from "@/auth";

export default async function Home() {
  const studentId = await currentStudentId();
  if (studentId) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">engdepthanal</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        See everything you need to learn in first-year engineering, track what
        you have covered — and discover what your university will{" "}
        <em>not</em> teach you, from the students who finished before you.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Get started
      </Link>
    </main>
  );
}
