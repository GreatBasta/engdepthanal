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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold">engdepthanal</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        Sign in or create an account to access the first-year database.
      </p>
      <AuthForms next={next ?? "/dashboard"} />
    </main>
  );
}
