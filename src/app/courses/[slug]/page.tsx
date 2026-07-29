import Link from "next/link";
import { notFound } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";

import { updateCourseMemberAction } from "./actions";
import { CommunityPanel } from "./community-panel";
import { InviteMemberForm } from "./contributors-ui";
import { CurriculumPanel } from "./curriculum-panel";
import { ExamPanel } from "./exam-panel";

const TABS = [
  ["overview", "Overview"],
  ["curriculum", "Curriculum"],
  ["community", "Community"],
  ["exam", "Exam"],
  ["contributors", "Contributors"],
] as const;

type CourseTab = (typeof TABS)[number][0];

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string; preview?: string }>;
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
            preview={query.preview}
          />
        ) : null}
        {tab === "community" ? (
          <CommunityPanel
            coursePageId={detail.course.id}
            courseSlug={detail.course.slug}
            canPost={detail.permissions.canPost}
            canModerate={detail.permissions.canModerate}
            canReport={studentId !== null}
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
        {tab === "contributors" ? (
          <Contributors
            members={detail.members}
            canManage={detail.permissions.canManageMembers}
            coursePageId={detail.course.id}
            courseSlug={detail.course.slug}
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
            href={`/courses/${detail.course.slug}?tab=curriculum`}
            className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Edit curriculum
          </Link>
        ) : null}
      </aside>
    </div>
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
