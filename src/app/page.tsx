import Link from "next/link";
import { redirect } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getPrimaryEnrollmentForStudent } from "@/lib/enrollment";
import { getAuthenticatedHomeData } from "@/lib/home/data";

export default async function Home() {
  const studentId = await currentStudentId();
  if (!studentId) return <AnonymousHome />;

  const primary = await getPrimaryEnrollmentForStudent(studentId);
  if (!primary) redirect("/onboarding");
  const dashboard = await getAuthenticatedHomeData(
    studentId,
    primary.organizationId,
  );
  const organizationName =
    primary.organizationName ?? primary.organizationFallbackName;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 pb-24 sm:px-6 sm:py-10 md:pb-12">
      <header className="rounded-3xl bg-gradient-to-br from-indigo-700 to-violet-600 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-indigo-100">Your university</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
              {organizationName}
            </h1>
            <p className="mt-2 text-sm text-indigo-100">
              {[primary.organizationCity, primary.organizationCountryName ?? primary.organizationCountryCode]
                .filter(Boolean)
                .join(", ")}
            </p>
          </div>
          <Link
            href="/profile#study-context"
            className="inline-flex min-h-11 items-center rounded-xl border border-white/30 bg-white/10 px-4 text-sm font-semibold hover:bg-white/20"
          >
            Change university
          </Link>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/courses?scope=mine&organization=${primary.organizationId}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-indigo-700"
          >
            Discover courses at {organizationName}
          </Link>
          <Link
            href="/courses/new"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 px-5 text-sm font-bold text-white"
          >
            Create course
          </Link>
        </div>
      </header>

      {dashboard.pendingRequests.length ? (
        <section className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                Review needed
              </p>
              <h2 className="mt-1 text-lg font-black text-amber-950">
                Pending co-ownership requests
              </h2>
            </div>
            <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold text-amber-900">
              {dashboard.pendingRequests.length}
            </span>
          </div>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {dashboard.pendingRequests.map((request) => (
              <li key={request.id}>
                <Link
                  href={`/courses/${request.courseSlug}/settings/members`}
                  className="block min-h-11 rounded-xl bg-white p-3 text-sm text-amber-950 shadow-sm"
                >
                  <span className="font-bold">{request.requesterName}</span> requested
                  co-ownership of {request.courseName}.
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-700">Continue</p>
            <h2 className="mt-1 text-2xl font-black">Your active courses</h2>
          </div>
          <Link href="/my-courses" className="text-sm font-bold text-indigo-700">
            View all
          </Link>
        </div>
        {dashboard.owned.length || dashboard.coowned.length || dashboard.visiting.length ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <CourseList title="Owned" courses={dashboard.owned} />
            <CourseList title="Co-owned" courses={dashboard.coowned} />
            <CourseList title="Visiting" courses={dashboard.visiting} />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
            You have not joined a course yet. Discover a public course at your university
            or create the first page.
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <h2 className="text-xl font-black">Recent at {organizationName}</h2>
          {dashboard.recentCourses.length ? (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {dashboard.recentCourses.map((course) => (
                <li key={course.slug}>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="block h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300"
                  >
                    <h3 className="font-bold">{course.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {course.programName} · {course.academicYear}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      Updated {formatDate(course.updatedAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">
              No public courses are available for this university yet.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black">What changed</h2>
          <h3 className="mt-5 text-sm font-bold text-slate-700">Recent resources</h3>
          <ul className="mt-2 space-y-2">
            {dashboard.recentResources.map((resource) => (
              <li key={resource.id}>
                <Link
                  href={`/courses/${resource.courseSlug}?tab=resources`}
                  className="block rounded-xl bg-slate-50 p-3 text-sm"
                >
                  <span className="font-semibold">
                    {resource.title || resource.type.replaceAll("_", " ")}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {resource.courseName} · {formatDate(resource.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
            {!dashboard.recentResources.length ? (
              <li className="text-sm text-slate-500">No recent public resources.</li>
            ) : null}
          </ul>
          <h3 className="mt-5 text-sm font-bold text-slate-700">Recent exam activity</h3>
          <ul className="mt-2 space-y-2">
            {dashboard.recentExamActivity.map((activity) => (
              <li key={activity.id}>
                <Link
                  href={`/courses/${activity.courseSlug}?tab=exam`}
                  className="block rounded-xl bg-slate-50 p-3 text-sm"
                >
                  <span className="font-semibold">{activity.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {activity.courseName} · {formatDate(activity.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
            {!dashboard.recentExamActivity.length ? (
              <li className="text-sm text-slate-500">No recent public exam activity.</li>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  );
}

function AnonymousHome() {

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center gap-10 px-4 py-12 sm:px-6 md:grid md:grid-cols-[1.1fr_0.9fr] md:items-center">
      <section>
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          Real course pages · student-contributed · non-official
        </span>
        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
          Find your actual course.{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">
            Learn with context.
          </span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
          Compare a real syllabus with reusable engineering foundations, track
          your learning privately, share resources where they belong, and see
          recurring exam patterns with transparent confidence.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/courses"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Find your course
          </Link>
          <Link
            href="/login?next=/courses/new"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
          >
            Create a course page
          </Link>
        </div>
      </section>

      <dl className="grid gap-3">
        {[
          {
            title: "Curriculum coverage",
            body: "Covered, not covered, or still unknown — distinct from your private progress.",
          },
          {
            title: "Resources in context",
            body: "Notes, links, images and permitted PDFs attached to the relevant topic.",
          },
          {
            title: "Recurring questions",
            body: "Student reports show counts and recency; confidence labels prevent false certainty.",
          },
        ].map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <dt className="font-bold">{feature.title}</dt>
            <dd className="mt-1 text-sm leading-6 text-slate-600">
              {feature.body}
            </dd>
          </div>
        ))}
      </dl>
    </main>
  );
}

type HomeCourse = Awaited<ReturnType<typeof getAuthenticatedHomeData>>["owned"][number];

function CourseList({ title, courses }: { title: string; courses: HomeCourse[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-black text-slate-700">{title}</h3>
      {courses.length ? (
        <ul className="mt-3 space-y-2">
          {courses.map((course) => (
            <li key={course.slug}>
              <Link
                href={`/courses/${course.slug}`}
                className="block min-h-11 rounded-xl bg-slate-50 p-3"
              >
                <span className="block font-bold">{course.name}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {course.organizationName} · {course.academicYear}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">None yet.</p>
      )}
    </section>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
