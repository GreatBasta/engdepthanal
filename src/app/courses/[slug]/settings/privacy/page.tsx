import { notFound } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";

import { updateCourseSettingsAction } from "../../actions";

export default async function PrivacySettings({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ slug }, query, studentId] = await Promise.all([
    params,
    searchParams,
    currentStudentId(),
  ]);
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail?.permissions.canEdit) notFound();
  return (
    <div className="max-w-2xl space-y-4">
    {query.saved === "1" ? (
      <p
        role="status"
        className="rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
      >
        Privacy settings saved.
      </p>
    ) : null}
    <form action={updateCourseSettingsAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="coursePageId" value={detail.course.id} />
      <input type="hidden" name="courseSlug" value={slug} />
      <input type="hidden" name="returnTo" value="privacy" />
      <input
        type="hidden"
        name="universityProgramId"
        value={detail.course.universityProgramId}
      />
      <input type="hidden" name="localName" value={detail.course.localName} />
      <input type="hidden" name="courseCode" value={detail.course.courseCode ?? ""} />
      <input type="hidden" name="professorName" value={detail.course.professorName ?? ""} />
      <input type="hidden" name="academicYear" value={detail.course.academicYear} />
      <input type="hidden" name="cohortYear" value={detail.course.cohortYear ?? ""} />
      <input type="hidden" name="semester" value={detail.course.semester ?? ""} />
      <input type="hidden" name="description" value={detail.course.description ?? ""} />
      <h2 className="font-bold">Visibility</h2>
      <p className="mt-1 text-sm text-slate-600">
        Private and unlisted courses never appear in public search. Unlisted pages remain accessible by link.
      </p>
      <div className="mt-5 grid gap-3">
        {[
          ["public", "Public", "Listed in Discover and indexable."],
          ["unlisted", "Unlisted", "Accessible by link, omitted from search, noindex."],
          ["private", "Private", "Only members and invited users can access."],
        ].map(([value, label, description]) => (
          <label key={value} className="flex min-h-14 cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50">
            <input type="radio" name="visibility" value={value} defaultChecked={detail.course.visibility === value} />
            <span>
              <span className="block font-semibold">{label}</span>
              <span className="block text-sm text-slate-600">{description}</span>
            </span>
          </label>
        ))}
      </div>
      <button className="mt-5 min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
        Save privacy
      </button>
    </form>
    </div>
  );
}
