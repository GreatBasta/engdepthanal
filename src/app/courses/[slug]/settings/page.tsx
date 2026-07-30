import { notFound } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";

import { updateCourseSettingsAction } from "../actions";

export default async function GeneralCourseSettings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, studentId] = await Promise.all([params, currentStudentId()]);
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail?.permissions.canEdit) notFound();
  const input = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3";

  return (
    <form action={updateCourseSettingsAction} className="max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="coursePageId" value={detail.course.id} />
      <input type="hidden" name="courseSlug" value={slug} />
      <label className="block text-sm font-semibold">
        Local course name
        <input name="localName" required defaultValue={detail.course.localName} className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Code
          <input name="courseCode" defaultValue={detail.course.courseCode ?? ""} className={input} />
        </label>
        <label className="block text-sm font-semibold">
          Professor
          <input name="professorName" defaultValue={detail.course.professorName ?? ""} className={input} />
        </label>
        <label className="block text-sm font-semibold">
          Academic year
          <input name="academicYear" required defaultValue={detail.course.academicYear} className={input} />
        </label>
        <label className="block text-sm font-semibold">
          Cohort year
          <input name="cohortYear" type="number" min={2000} max={2100} defaultValue={detail.course.cohortYear ?? ""} className={input} />
        </label>
        <label className="block text-sm font-semibold">
          Semester
          <input name="semester" type="number" min={1} max={12} defaultValue={detail.course.semester ?? ""} className={input} />
        </label>
      </div>
      <label className="block text-sm font-semibold">
        Description
        <textarea name="description" rows={5} defaultValue={detail.course.description ?? ""} className={`${input} py-3`} />
      </label>
      <input type="hidden" name="visibility" value={detail.course.visibility} />
      <button className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
        Save settings
      </button>
    </form>
  );
}
