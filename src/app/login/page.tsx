import { redirect } from "next/navigation";

import { currentStudentId } from "@/auth";
import { AuthForms } from "./ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const studentId = await currentStudentId();
  if (studentId) redirect("/dashboard");
  const { next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Course Atlas</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to your courses, private progress, and contributions.
        </p>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <AuthForms next={next ?? "/dashboard"} />
      </div>
      <p className="mt-6 text-center text-xs text-zinc-500">
        Your personal learning progress is private to your account.
      </p>
    </main>
  );
}
