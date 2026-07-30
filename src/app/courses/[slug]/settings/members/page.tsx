import { notFound } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";

import { updateCourseMemberAction } from "../../actions";
import { InviteMemberForm } from "../../contributors-ui";

export default async function MemberSettings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, studentId] = await Promise.all([params, currentStudentId()]);
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail?.permissions.canManageMembers) notFound();
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <h2 className="font-bold">Members</h2>
        <ul className="mt-4 space-y-3">
          {detail.members.map((member) => (
            <li key={member.studentId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-semibold">{member.name}</p>
              <form action={updateCourseMemberAction} className="mt-3 grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="coursePageId" value={detail.course.id} />
                <input type="hidden" name="courseSlug" value={slug} />
                <input type="hidden" name="studentId" value={member.studentId} />
                <select name="role" defaultValue={member.role} className="min-h-11 rounded-xl border border-slate-300 px-3">
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="contributor">Member</option>
                  <option value="viewer">Member (read only)</option>
                </select>
                <select name="attendance" defaultValue={member.attendance} className="min-h-11 rounded-xl border border-slate-300 px-3">
                  <option value="attended">Attended</option>
                  <option value="not_attended">Not attended</option>
                </select>
                <button className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold">Save</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <InviteMemberForm coursePageId={detail.course.id} courseSlug={slug} />
    </div>
  );
}
