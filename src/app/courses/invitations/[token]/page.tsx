import { createHash } from "node:crypto";
import Link from "next/link";
import { and, eq, gt } from "drizzle-orm";
import { redirect } from "next/navigation";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  courseInvites,
  coursePages,
  students,
  universities,
  universityPrograms,
} from "@/lib/db/schema";

import { acceptCourseInviteAction } from "../../[slug]/actions";

export default async function CourseInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (token.length < 32 || token.length > 200) redirect("/courses");

  const studentId = await currentStudentId();
  if (!studentId) {
    redirect(`/login?next=/courses/invitations/${token}`);
  }

  const digest = createHash("sha256").update(token).digest("hex");
  const [[student], [invite]] = await Promise.all([
    db
      .select({ email: students.email })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1),
    db
      .select({
        email: courseInvites.email,
        role: courseInvites.role,
        attendance: courseInvites.attendance,
        courseName: coursePages.localName,
        universityName: universities.name,
      })
      .from(courseInvites)
      .innerJoin(
        coursePages,
        eq(courseInvites.coursePageId, coursePages.id),
      )
      .innerJoin(
        universityPrograms,
        eq(coursePages.universityProgramId, universityPrograms.id),
      )
      .innerJoin(
        universities,
        eq(universityPrograms.universityId, universities.id),
      )
      .where(
        and(
          eq(courseInvites.tokenHash, digest),
          eq(courseInvites.status, "pending"),
          gt(courseInvites.expiresAt, new Date()),
        ),
      )
      .limit(1),
  ]);

  const validForStudent =
    student && invite && student.email.toLowerCase() === invite.email;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-12">
      <section className="w-full rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {validForStudent ? (
          <>
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
              Course invitation
            </p>
            <h1 className="mt-2 text-2xl font-bold">{invite.courseName}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {invite.universityName}
            </p>
            <p className="mt-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              You will join as <strong>{invite.role}</strong>. Your attendance
              will be marked as{" "}
              <strong>{invite.attendance.replace("_", " ")}</strong>.
            </p>
            <form action={acceptCourseInviteAction} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Accept invitation
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Invitation unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              This link is expired, already used, or belongs to a different
              email address.
            </p>
            <Link
              href="/courses"
              className="mt-6 inline-flex text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Browse public courses
            </Link>
          </>
        )}
      </section>
    </main>
  );
}

