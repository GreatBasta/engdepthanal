import Link from "next/link";
import { redirect } from "next/navigation";

import { currentStudentId } from "@/auth";

export default async function Home() {
  const studentId = await currentStudentId();
  if (studentId) redirect("/my-courses");

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
