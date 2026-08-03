import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";
import { db } from "@/lib/db/client";
import { courseCoownershipRequests, coursePages } from "@/lib/db/schema";
import { getI18n } from "@/lib/i18n/server";

import { joinCourseAction } from "./actions";
import {
  cancelCoownershipRequestAction,
  leaveCoownershipAction,
  requestCoownershipAction,
} from "./coownership-actions";
import { CurriculumPanel } from "./curriculum-panel";
import { ExamPanel } from "./exam-panel";
import { ResourcesPanel } from "./resources-panel";

const TAB_KEYS = ["overview", "curriculum", "resources", "exam"] as const;
type CourseTab = (typeof TAB_KEYS)[number];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { t } = await getI18n();
  const [course] = await db
    .select({
      name: coursePages.localName,
      description: coursePages.description,
      visibility: coursePages.visibility,
    })
    .from(coursePages)
    .where(eq(coursePages.slug, slug))
    .limit(1);
  if (!course) return { title: t("course.notFound"), robots: { index: false } };
  const indexable = course.visibility === "public";
  return {
    title: indexable ? course.name : t("course.shared"),
    description: indexable
      ? (course.description ?? t("course.publicDescription"))
      : t("course.privateDescription"),
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
  const [{ slug }, query, studentId, i18n] = await Promise.all([
    params,
    searchParams,
    currentStudentId(),
    getI18n(),
  ]);
  const { t } = i18n;
  const tabs: Array<[CourseTab, string]> = [
    ["overview", t("course.overview")],
    ["curriculum", t("course.curriculum")],
    ["resources", t("course.resources")],
    ["exam", t("course.exam")],
  ];
  const detail = await getCourseBySlugForViewer(slug, studentId, {
    templates: true,
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

  const tab: CourseTab = TAB_KEYS.some((key) => key === query.tab)
    ? (query.tab as CourseTab)
    : "overview";
  return (
    <main className="min-h-screen pb-16">
      <div className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={studentId ? "/" : "/courses"}
              className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              ← {studentId ? t("course.home") : t("course.directory")}
            </Link>
            <div className="flex items-center gap-2">
              <VisibilityBadge visibility={detail.course.visibility} />
              {detail.permissions.role ? (
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {detail.permissions.role === "coowner"
                    ? t("roles.coowner")
                    : detail.permissions.role === "owner"
                      ? t("roles.owner")
                      : t("roles.visitor")}
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
                <span>
                  {t("course.semester")} {detail.course.semester}
                </span>
              ) : null}
              {detail.course.professorName ? (
                <span>Prof. {detail.course.professorName}</span>
              ) : null}
            </p>
          </div>
        </div>

        <nav
          aria-label={t("course.sections")}
          className="mx-auto max-w-6xl overflow-x-auto px-4 sm:px-6"
        >
          <div className="flex min-w-max gap-1">
            {tabs.map(([key, label]) => (
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
            requestStatus={query.request}
          />
        ) : null}
        {tab === "curriculum" ? (
          <CurriculumPanel
            coursePageId={detail.course.id}
            courseSlug={detail.course.slug}
            canEdit={detail.permissions.canEdit}
            canTrack={detail.permissions.role !== null}
            lastAppliedAt={detail.course.updatedAt}
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

async function Overview({
  detail,
  pendingCoownershipRequest,
  requestStatus,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof getCourseBySlugForViewer>>>;
  pendingCoownershipRequest: { id: string } | null;
  requestStatus: string | undefined;
}) {
  const { t, formatDate } = await getI18n();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-indigo-600 dark:text-indigo-400">
          {t("course.about")}
        </p>
        <p className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300">
          {detail.course.description || t("course.noDescription")}
        </p>
        <dl className="mt-7 grid gap-4 border-t border-zinc-200 pt-6 text-sm dark:border-zinc-800 sm:grid-cols-2">
          <Metadata
            label={t("course.academicYear")}
            value={detail.course.academicYear}
          />
          <Metadata
            label={t("course.cohort")}
            value={
              detail.course.cohortYear?.toString() || t("course.notSpecified")
            }
          />
          <Metadata
            label={t("course.semester")}
            value={
              detail.course.semester?.toString() || t("course.notSpecified")
            }
          />
          <Metadata
            label={t("course.professor")}
            value={detail.course.professorName || t("course.notSpecified")}
          />
          <Metadata
            label={t("course.createdBy")}
            value={detail.course.creatorName}
          />
          <Metadata
            label={t("course.lastUpdated")}
            value={formatDate(detail.course.updatedAt)}
          />
        </dl>
      </section>

      <aside className="space-y-4">
        {requestStatus === "pending" || requestStatus === "already-pending" ? (
          <p
            role="status"
            className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
          >
            {t("course.requestSubmitted")}
          </p>
        ) : requestStatus === "cancelled" ? (
          <p
            role="status"
            className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700"
          >
            {t("course.requestCancelled")}
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
              {t("course.attendance")}
              <select
                name="attendance"
                className="mt-1 min-h-11 w-full rounded-xl border border-indigo-200 bg-white px-3"
              >
                <option value="not_attended">{t("course.notAttended")}</option>
                <option value="attended">{t("course.attended")}</option>
              </select>
            </label>
            <button className="mt-3 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
              {t("course.join")}
            </button>
          </form>
        ) : null}
        {detail.permissions.role === "visitor" ? (
          pendingCoownershipRequest ? (
            <form
              action={cancelCoownershipRequestAction}
              className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
            >
              <input
                type="hidden"
                name="coursePageId"
                value={detail.course.id}
              />
              <input
                type="hidden"
                name="courseSlug"
                value={detail.course.slug}
              />
              <p className="font-bold text-amber-950">
                {t("course.requestPending")}
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                {t("course.requestPendingHelp")}
              </p>
              <button className="mt-3 min-h-11 rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950">
                {t("course.cancelRequest")}
              </button>
            </form>
          ) : (
            <form
              action={requestCoownershipAction}
              className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5"
            >
              <input
                type="hidden"
                name="coursePageId"
                value={detail.course.id}
              />
              <input
                type="hidden"
                name="courseSlug"
                value={detail.course.slug}
              />
              <h2 className="font-bold text-indigo-950">
                {t("course.requestCoownership")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-indigo-900">
                {t("course.requestHelp")}
              </p>
              <label className="mt-3 block text-sm font-semibold text-indigo-950">
                {t("course.messageOptional")}
                <textarea
                  name="message"
                  maxLength={800}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-indigo-200 bg-white p-3"
                />
              </label>
              <button className="mt-3 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
                {t("course.requestCoownership")}
              </button>
            </form>
          )
        ) : null}
        {detail.permissions.role === "coowner" ? (
          <form
            action={leaveCoownershipAction}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <input type="hidden" name="coursePageId" value={detail.course.id} />
            <input type="hidden" name="courseSlug" value={detail.course.slug} />
            <p className="text-sm text-slate-600">{t("course.leaveHelp")}</p>
            <button className="mt-3 min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold">
              {t("course.leaveCoownership")}
            </button>
          </form>
        ) : null}
        {detail.course.officialSourceUrl ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-semibold text-emerald-950">
              {t("catalog.officialSource")}
            </h2>
            <p className="mt-1 text-sm text-emerald-900">
              {detail.course.officialSourceName}
              {detail.course.officialCredits
                ? ` · ${detail.course.officialCredits} ${t("course.credits")}`
                : ""}
            </p>
            <a
              href={detail.course.officialSourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-indigo-700 underline"
            >
              {t("catalog.officialSource")}
            </a>
          </section>
        ) : null}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="font-semibold">{t("course.sources")}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {detail.templates.map((template) => (
              <li key={template.id}>{template.name}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            {t("course.sourcesHelp")}
          </p>
        </section>

        {detail.permissions.canEdit ? (
          <Link
            href={`/courses/${detail.course.slug}/settings/curriculum`}
            className="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {t("course.editCurriculum")}
          </Link>
        ) : null}
        {detail.permissions.canManageCourseSettings ? (
          <Link
            href={`/courses/${detail.course.slug}/settings`}
            className="flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold"
          >
            {t("course.settings")}
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

async function VisibilityBadge({
  visibility,
}: {
  visibility: "public" | "unlisted" | "private";
}) {
  const { t } = await getI18n();
  const label = {
    public: t("course.public"),
    unlisted: t("course.unlisted"),
    private: t("course.private"),
  }[visibility];
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {label}
    </span>
  );
}
