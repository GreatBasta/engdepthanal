import { notFound } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";
import { getI18n } from "@/lib/i18n/server";

import { updateCourseSettingsAction } from "../../actions";

export default async function PrivacySettings({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ slug }, query, studentId, i18n] = await Promise.all([
    params,
    searchParams,
    currentStudentId(),
    getI18n(),
  ]);
  const { t } = i18n;
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail?.permissions.canManageCourseSettings) notFound();
  return (
    <div className="max-w-2xl space-y-4">
      {query.saved === "1" ? (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
        >
          {t("settings.privacySaved")}
        </p>
      ) : null}
      <form
        action={updateCourseSettingsAction}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <input type="hidden" name="coursePageId" value={detail.course.id} />
        <input type="hidden" name="courseSlug" value={slug} />
        <input type="hidden" name="returnTo" value="privacy" />
        <input
          type="hidden"
          name="universityProgramId"
          value={detail.course.universityProgramId}
        />
        <input type="hidden" name="localName" value={detail.course.localName} />
        <input
          type="hidden"
          name="courseCode"
          value={detail.course.courseCode ?? ""}
        />
        <input
          type="hidden"
          name="professorName"
          value={detail.course.professorName ?? ""}
        />
        <input
          type="hidden"
          name="academicYear"
          value={detail.course.academicYear}
        />
        <input
          type="hidden"
          name="cohortYear"
          value={detail.course.cohortYear ?? ""}
        />
        <input
          type="hidden"
          name="semester"
          value={detail.course.semester ?? ""}
        />
        <input
          type="hidden"
          name="description"
          value={detail.course.description ?? ""}
        />
        <h2 className="font-bold">{t("settings.visibility")}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("settings.visibilityHelp")}
        </p>
        <div className="mt-5 grid gap-3">
          {[
            ["public", t("course.public"), t("settings.publicHelp")],
            ["unlisted", t("course.unlisted"), t("settings.unlistedHelp")],
            ["private", t("course.private"), t("settings.privateHelp")],
          ].map(([value, label, description]) => (
            <label
              key={value}
              className="flex min-h-14 cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
            >
              <input
                type="radio"
                name="visibility"
                value={value}
                defaultChecked={detail.course.visibility === value}
              />
              <span>
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-slate-600">
                  {description}
                </span>
              </span>
            </label>
          ))}
        </div>
        <button className="mt-5 min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
          {t("settings.savePrivacy")}
        </button>
      </form>
    </div>
  );
}
