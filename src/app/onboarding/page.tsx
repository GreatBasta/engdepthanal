import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { enrollments, programs } from "@/lib/db/schema";
import { OnboardingForm } from "./ui";

export default async function OnboardingPage() {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login");

  // Already onboarded → straight to the dashboard.
  const [existing] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(eq(enrollments.studentId, studentId))
    .limit(1);
  if (existing) redirect("/dashboard");

  const programRows = await db
    .select({ slug: programs.slug, name: programs.name })
    .from(programs)
    .orderBy(asc(programs.name));

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <h1 className="mb-1 text-2xl font-bold">Welcome 👋</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        Tell us where and what you study — this unlocks the full first-year
        database for your course. Search the worldwide registry and select the
        exact institution you attend.
      </p>
      <OnboardingForm programs={programRows} />
    </main>
  );
}
