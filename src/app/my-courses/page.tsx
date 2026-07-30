import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import { courseMembers, coursePages } from "@/lib/db/schema";

export const metadata = { title: "My courses" };

export default async function MyCoursesPage() {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login?next=/my-courses");

  const courses = await db
    .select({
      slug: coursePages.slug,
      name: coursePages.localName,
      code: coursePages.courseCode,
      year: coursePages.academicYear,
      visibility: coursePages.visibility,
      role: courseMembers.role,
      updatedAt: coursePages.updatedAt,
    })
    .from(courseMembers)
    .innerJoin(coursePages, eq(courseMembers.coursePageId, coursePages.id))
    .where(
      and(
        eq(courseMembers.studentId, studentId),
        isNull(coursePages.archivedAt),
      ),
    )
    .orderBy(desc(coursePages.updatedAt));

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-indigo-700">Your learning space</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">My courses</h1>
          <p className="mt-2 text-slate-600">
            Course coverage is shared. Your learning progress stays private.
          </p>
        </div>
        <Link
          href="/courses/new"
          className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Create course
        </Link>
      </header>

      {courses.length ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.slug}>
              <Link
                href={`/courses/${course.slug}`}
                className="block min-h-40 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold capitalize text-indigo-700">
                    {course.role === "contributor"
                      ? "Editor"
                      : course.role === "viewer"
                        ? "Member"
                        : course.role}
                  </span>
                  <span className="text-xs capitalize text-slate-500">
                    {course.visibility}
                  </span>
                </div>
                <h2 className="mt-4 text-lg font-bold">{course.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {course.code ? `${course.code} · ` : ""}
                  {course.year}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h2 className="font-bold">No joined courses yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Discover an existing course or create its collaborative page.
          </p>
          <Link
            href="/courses"
            className="mt-5 inline-flex min-h-11 items-center font-semibold text-indigo-700"
          >
            Discover courses
          </Link>
        </section>
      )}
    </main>
  );
}
