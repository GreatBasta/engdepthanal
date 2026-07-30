import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";
import { db } from "@/lib/db/client";
import { coursePages } from "@/lib/db/schema";

import {
  joinCourseAction,
  updateCourseMemberAction,
  updateCourseSettingsAction,
} from "./actions";
import { InviteMemberForm } from "./contributors-ui";
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
  }>;
}) {
  const [{ slug }, query, studentId] = await Promise.all([
    params,
    searchParams,
    currentStudentId(),
  ]);
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail) notFound();

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
              href={studentId ? "/dashboard" : "/courses"}
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              ← {studentId ? "Dashboard" : "Course directory"}
            </Link>
            <div className="flex items-center gap-2">
              <VisibilityBadge visibility={detail.course.visibility} />
              {detail.permissions.role ? (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {detail.permissions.role}
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
          <Overview detail={detail} publishedVersion={published?.version} />
        ) : null}
        {tab === "curriculum" ? (
          <CurriculumPanel
            coursePageId={detail.course.id}
            courseSlug={detail.course.slug}
            canEdit={detail.permissions.canEdit}
            canTrack={detail.permissions.role !== null}
            preview={query.preview}
          />
        ) : null}
        {tab === "resources" ? (
          <ResourcesPanel
            coursePageId={detail.course.id}
            courseSlug={detail.course.slug}
            canPost={detail.permissions.canPost}
            page={Number(query.page) || 1}
            selectedSubtopic={query.subtopic}
          />
        ) : null}
        {tab === "exam" ? (
          <ExamPanel
            coursePageId={detail.course.id}
            courseSlug={detail.course.slug}
            canPost={detail.permissions.canPost}
            canEdit={detail.permissions.canEdit}
            canModerate={detail.permissions.canModerate}
          />
        ) : null}
      </div>
    </main>
  );
}

function Overview({
  detail,
  publishedVersion,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getCourseBySlugForViewer>>>;
  publishedVersion: number | undefined;
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
          <>
            <Link
              href={`/courses/${detail.course.slug}/settings/curriculum`}
              className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Edit curriculum
            </Link>
            <Link
              href={`/courses/${detail.course.slug}/settings`}
              className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"
            >
              Course settings
            </Link>
          </>
        ) : null}
      </aside>
    </div>
  );
}

function CourseSettings({
  detail,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getCourseBySlugForViewer>>>;
}) {
  const inputClass =
    "mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <details className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="cursor-pointer font-semibold">Course settings</summary>
      <form action={updateCourseSettingsAction} className="mt-5 space-y-4">
        <input type="hidden" name="coursePageId" value={detail.course.id} />
        <input type="hidden" name="courseSlug" value={detail.course.slug} />
        <label className="block text-sm font-medium">
          Local course name
          <input
            name="localName"
            required
            minLength={2}
            maxLength={180}
            defaultValue={detail.course.localName}
            className={inputClass}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Course code
            <input
              name="courseCode"
              maxLength={40}
              defaultValue={detail.course.courseCode ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Professor
            <input
              name="professorName"
              maxLength={120}
              defaultValue={detail.course.professorName ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm font-medium">
            Academic year
            <input
              name="academicYear"
              required
              defaultValue={detail.course.academicYear}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Cohort
            <input
              name="cohortYear"
              type="number"
              min={2000}
              max={2100}
              defaultValue={detail.course.cohortYear ?? ""}
              className={inputClass}
            />
          </label>
          <label className="block text-sm font-medium">
            Semester
            <input
              name="semester"
              type="number"
              min={1}
              max={12}
              defaultValue={detail.course.semester ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <label className="block text-sm font-medium">
          Description
          <textarea
            name="description"
            rows={4}
            maxLength={2_000}
            defaultValue={detail.course.description ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium">
          Visibility
          <select
            name="visibility"
            defaultValue={detail.course.visibility}
            className={inputClass}
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </label>
        <button
          type="submit"
          className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Save course settings
        </button>
      </form>
    </details>
  );
}

function Contributors({
  members,
  canManage,
  coursePageId,
  courseSlug,
}: {
  members: NonNullable<
    Awaited<ReturnType<typeof getCourseBySlugForViewer>>
  >["members"];
  canManage: boolean;
  coursePageId: string;
  courseSlug: string;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Contributors</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Course roles and attendance are independent.
          </p>
        </div>
        {canManage ? (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            Member management enabled
          </span>
        ) : null}
      </div>
      <ul className="mt-6 divide-y divide-zinc-200 dark:divide-zinc-800">
        {members.map((member) => (
          <li
            key={member.studentId}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <span className="font-medium">{member.name}</span>
            {canManage ? (
              <form
                action={updateCourseMemberAction}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="hidden"
                  name="coursePageId"
                  value={coursePageId}
                />
                <input type="hidden" name="courseSlug" value={courseSlug} />
                <input type="hidden" name="studentId" value={member.studentId} />
                <select
                  name="role"
                  defaultValue={member.role}
                  aria-label={`Role for ${member.name}`}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs capitalize dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="contributor">Contributor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <select
                  name="attendance"
                  defaultValue={member.attendance}
                  aria-label={`Attendance for ${member.name}`}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="attended">Attended</option>
                  <option value="not_attended">Not attended</option>
                </select>
                <button
                  type="submit"
                  className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Save
                </button>
              </form>
            ) : (
              <span className="flex gap-2 text-xs">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 capitalize dark:bg-zinc-800">
                  {member.role}
                </span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 capitalize dark:bg-zinc-800">
                  {member.attendance.replace("_", " ")}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {canManage ? (
        <InviteMemberForm
          coursePageId={coursePageId}
          courseSlug={courseSlug}
        />
      ) : null}
    </section>
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
