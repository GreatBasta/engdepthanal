import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";
import { db } from "@/lib/db/client";
import { courseCoownershipRequests, coursePages } from "@/lib/db/schema";

import { joinCourseAction } from "./actions";
import {
  cancelCoownershipRequestAction,
  leaveCoownershipAction,
  requestCoownershipAction,
} from "./coownership-actions";
import { CurriculumPanel } from "./curriculum-panel";
import { ExamPanel } from "./exam-panel";
import { ResourcesPanel } from "./resources-panel";

const TABS = [
  ["overview", "Overview"],
  ["curriculum", "Curriculum"],
  ["resources", "Resources"],
  ["exam", "Exam"],
] as const;

type CourseTab = (typeof TABS)[number][0];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [course] = await db
    .select({
      name: coursePages.localName,
      description: coursePages.description,
      visibility: coursePages.visibility,
    })
    .from(coursePages)
    .where(eq(coursePages.slug, slug))
    .limit(1);
  if (!course) return { title: "Course not found", robots: { index: false } };
  const indexable = course.visibility === "public";
  return {
    title: indexable ? course.name : "Shared course",
    description: indexable
      ? course.description ?? "Student-contributed university course page."
      : "A non-public student-contributed course page.",
    alternates: {
      canonical: indexable ? `/courses/${slug}` : undefined,
    },
    robots: { index: indexable, follow: indexable },
  };
}

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tab?: string;
    preview?: string;
    page?: string;
    subtopic?: string;
    topic?: string;
    request?: string;
    coownership?: string;
  }>;
}) {
  const [{ slug }, query, studentId] = await Promise.all([
    params,
    searchParams,
    currentStudentId(),
  ]);
  const detail = await getCourseBySlugForViewer(slug, studentId, {
    templates: true,
    versions: true,
  });
  if (!detail) notFound();
  const [pendingCoownershipRequest] =
    studentId && detail.permissions.role === "visitor"
      ? await db
          .select({ id: courseCoownershipRequests.id })
          .from(courseCoownershipRequests)
          .where(
            and(
              eq(courseCoownershipRequests.coursePageId, detail.course.id),
              eq(courseCoownershipRequests.requesterId, studentId),
              eq(courseCoownershipRequests.status, "pending"),
            ),
          )
          .limit(1)
      : [];

  const tab: CourseTab = TABS.some(([key]) => key === query.tab)
    ? (query.tab as CourseTab)
    : "overview";
  const published = detail.versions.find(
    (version) => version.status === "published",
  );

  return (
    <main className="min-h-screen pb-16">
      <div className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={studentId ? "/" : "/courses"}
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              ← {studentId ? "Home" : "Course directory"}
            </Link>
            <div className="flex items-center gap-2">
              <VisibilityBadge visibility={detail.course.visibility} />
              {detail.permissions.role ? (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {detail.permissions.role === "coowner"
                    ? "Co-owner"
                    : detail.permissions.role === "owner"
                      ? "Owner"
                      : "Visitor"}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-6 max-w-4xl">
            <p className="text-sm font-medium text-zinc-500">
              {detail.course.universityName} · {detail.course.programName}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {detail.course.localName}
            </h1>
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              {detail.course.courseCode ? (
                <span>{detail.course.courseCode}</span>
              ) : null}
              <span>{detail.course.academicYear}</span>
              {detail.course.semester ? (
                <span>Semester {detail.course.semester}</span>
              ) : null}
              {detail.course.professorName ? (
                <span>Prof. {detail.course.professorName}</span>
              ) : null}
            </p>
          </div>
        </div>

        <nav
          aria-label="Course sections"
          className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6"
        >
          <div className="flex min-w-max gap-1">
            {TABS.map(([key, label]) => (
              <Link
                key={key}
                href={`/courses/${slug}?tab=${key}`}
                aria-current={tab === key ? "page" : undefined}
                className={`border-b-2 px-3 py-3 text-sm font-medium transition ${
                  tab === key
                    ? "border-indigo-600 text-indigo-700 dark:text-indigo-300"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {tab === "overview" ? (
          <Overview
            detail={detail}
            pendingCoownershipRequest={pendingCoownershipRequest ?? null}
            publishedVersion={published?.version}
            requestStatus={query.request}
          />
        ) : null}
        {tab === "curriculum" ? (
          <CurriculumPanel
            coursePageId={detail.course.id}
            courseSlug={detail.course.slug}
            canEdit={detail.permissions.canEdit}
            canTrack={detail.permissions.role !== null}
            preview={query.preview}
            selectedTopic={query.topic}
            viewerStudentId={studentId}
          />
        ) : null}
        {tab === "resources" ? (
          <ResourcesPanel
            coursePageId={detail.course.id}
            courseSlug={detail.course.slug}
            canPost={detail.permissions.canPost}
            canModerate={detail.permissions.canModerate}
            page={Number(query.page) || 1}
            selectedSubtopic={query.subtopic}
          />
        ) : null}
        {tab === "exam" ? (
          <ExamPanel
            coursePageId={detail.course.id}
            courseSlug={detail.course.slug}
            canPost={detail.permissions.canPost}
            canModerate={detail.permissions.canModerate}
          />
        ) : null}
      </div>
    </main>
  );
}

function Overview({
  detail,
  pendingCoownershipRequest,
  publishedVersion,
  requestStatus,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getCourseBySlugForViewer>>>;
  pendingCoownershipRequest: { id: string } | null;
  publishedVersion: number | undefined;
  requestStatus: string | undefined;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
          About this course
        </p>
        <p className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300">
          {detail.course.description ||
            "No local description has been added yet."}
        </p>
        <dl className="mt-7 grid gap-4 border-t border-zinc-200 pt-6 text-sm dark:border-zinc-800 sm:grid-cols-2">
          <Metadata label="Academic year" value={detail.course.academicYear} />
          <Metadata
            label="Cohort"
            value={detail.course.cohortYear?.toString() || "Not specified"}
          />
          <Metadata
            label="Semester"
            value={detail.course.semester?.toString() || "Not specified"}
          />
          <Metadata
            label="Professor"
            value={detail.course.professorName || "Not specified"}
          />
          <Metadata label="Created by" value={detail.course.creatorName} />
          <Metadata
            label="Published curriculum"
            value={
              publishedVersion ? `Version ${publishedVersion}` : "Not yet"
            }
          />
        </dl>
      </section>

      <aside className="space-y-4">
        {requestStatus === "pending" || requestStatus === "already-pending" ? (
          <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            Your co-ownership request is pending Owner review.
          </p>
        ) : requestStatus === "cancelled" ? (
          <p role="status" className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
            Co-ownership request cancelled.
          </p>
        ) : null}
        {!detail.permissions.role ? (
          <form
            action={joinCourseAction}
            className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5"
          >
            <input type="hidden" name="coursePageId" value={detail.course.id} />
            <input type="hidden" name="courseSlug" value={detail.course.slug} />
            <label className="block text-sm font-semibold text-indigo-950">
              Attendance
              <select
                name="attendance"
                className="mt-1 min-h-11 w-full rounded-xl border border-indigo-200 bg-white px-3"
              >
                <option value="not_attended">Not attended</option>
                <option value="attended">Attended</option>
              </select>
            </label>
            <button className="mt-3 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
              Join course
            </button>
          </form>
        ) : null}
        {detail.permissions.role === "visitor" ? (
          pendingCoownershipRequest ? (
            <form action={cancelCoownershipRequestAction} className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <input type="hidden" name="coursePageId" value={detail.course.id} />
              <input type="hidden" name="courseSlug" value={detail.course.slug} />
              <p className="font-bold text-amber-950">Request pending</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                Only the course Owner can accept or reject this request.
              </p>
              <button className="mt-3 min-h-11 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950">
                Cancel request
              </button>
            </form>
          ) : (
            <form action={requestCoownershipAction} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
              <input type="hidden" name="coursePageId" value={detail.course.id} />
              <input type="hidden" name="courseSlug" value={detail.course.slug} />
              <h2 className="font-bold text-indigo-950">Request co-ownership</h2>
              <p className="mt-1 text-sm leading-6 text-indigo-900">
                Co-owners can edit and apply curriculum changes. The Owner must approve.
              </p>
              <label className="mt-3 block text-sm font-semibold text-indigo-950">
                Message (optional)
                <textarea name="message" maxLength={800} rows={3} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white p-3" />
              </label>
              <button className="mt-3 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
                Request co-ownership
              </button>
            </form>
          )
        ) : null}
        {detail.permissions.role === "coowner" ? (
          <form action={leaveCoownershipAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="coursePageId" value={detail.course.id} />
            <input type="hidden" name="courseSlug" value={detail.course.slug} />
            <p className="text-sm text-slate-600">You can return to Visitor without leaving the course.</p>
            <button className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">
              Leave co-ownership
            </button>
          </form>
        ) : null}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold">Source templates</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {detail.templates.map((template) => (
              <li key={template.id} className="flex justify-between gap-3">
                <span>{template.name}</span>
                <span className="text-zinc-500">v{template.version}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            These versions are immutable. Course edits never change the
            canonical source.
          </p>
        </section>

        {detail.permissions.canEdit ? (
            <Link
              href={`/courses/${detail.course.slug}/settings/curriculum`}
              className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Edit curriculum
            </Link>
        ) : null}
        {detail.permissions.canManageCourseSettings ? (
            <Link
              href={`/courses/${detail.course.slug}/settings`}
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"
            >
              Course settings
            </Link>
        ) : null}
      </aside>
    </div>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function VisibilityBadge({
  visibility,
}: {
  visibility: "public" | "unlisted" | "private";
}) {
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {visibility}
    </span>
  );
}
