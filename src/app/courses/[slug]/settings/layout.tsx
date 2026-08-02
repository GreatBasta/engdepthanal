import Link from "next/link";
import { notFound } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";
import { getI18n } from "@/lib/i18n/server";

export default async function CourseSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, studentId, i18n] = await Promise.all([
    params,
    currentStudentId(),
    getI18n(),
  ]);
  const { t } = i18n;
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail?.permissions.canEdit) notFound();
  const items = detail.permissions.canManageCourseSettings
    ? [
        ["", t("settings.general")],
        ["/members", t("members.title")],
        ["/curriculum", t("course.curriculum")],
        ["/privacy", t("settings.privacy")],
      ]
    : [["/curriculum", t("course.curriculum")]];
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href={`/courses/${slug}`}
        className="text-sm font-semibold text-indigo-700"
      >
        ← {t("settings.backCourse")}
      </Link>
      <h1 className="mt-5 text-3xl font-black">{t("settings.title")}</h1>
      <nav
        aria-label={t("settings.title")}
        className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {items.map(([suffix, label]) => (
          <Link
            key={suffix}
            href={`/courses/${slug}/settings${suffix}`}
            className="min-h-11 shrink-0 px-3 py-3 text-sm font-semibold text-slate-600 hover:text-indigo-700"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="py-6">{children}</div>
    </main>
  );
}
