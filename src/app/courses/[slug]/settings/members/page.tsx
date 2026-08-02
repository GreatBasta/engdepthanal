import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";
import { effectiveCourseRole } from "@/lib/courses/permissions";
import { db } from "@/lib/db/client";
import { courseCoownershipRequests, students } from "@/lib/db/schema";

import { updateCourseMemberAction } from "../../actions";
import { reviewCoownershipRequestAction } from "../../coownership-actions";
import { InviteMemberForm } from "../../contributors-ui";

export default async function MemberSettings({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const [{ slug }, query, studentId] = await Promise.all([
    params,
    searchParams,
    currentStudentId(),
  ]);
  const detail = await getCourseBySlugForViewer(slug, studentId, {
    members: true,
  });
  if (!detail?.permissions.canManageMembers) notFound();

  const pendingRequests = await db
    .select({
      id: courseCoownershipRequests.id,
      requesterId: courseCoownershipRequests.requesterId,
      requesterName: students.displayName,
      message: courseCoownershipRequests.message,
      requestedAt: courseCoownershipRequests.requestedAt,
    })
    .from(courseCoownershipRequests)
    .innerJoin(
      students,
      eq(courseCoownershipRequests.requesterId, students.id),
    )
    .where(
      and(
        eq(courseCoownershipRequests.coursePageId, detail.course.id),
        eq(courseCoownershipRequests.status, "pending"),
      ),
    )
    .orderBy(asc(courseCoownershipRequests.requestedAt));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-7">
        {query.review ? (
          <p
            role={query.review === "failed" ? "alert" : "status"}
            className={`rounded-xl p-3 text-sm ${
              query.review === "failed"
                ? "bg-red-50 text-red-800"
                : "bg-emerald-50 text-emerald-800"
            }`}
          >
            {query.review === "accepted"
              ? "The Visitor is now a Co-owner."
              : query.review === "rejected"
                ? "The request was rejected; the Visitor role is unchanged."
                : "The request could not be decided. Reload and try again."}
          </p>
        ) : null}

        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">Co-ownership requests</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">
              {pendingRequests.length} pending
            </span>
          </div>
          {pendingRequests.length ? (
            <ul className="mt-4 space-y-3">
              {pendingRequests.map((request) => (
                <li
                  key={request.id}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-4"
                >
                  <p className="font-bold text-amber-950">
                    {request.requesterName}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    Requested{" "}
                    {new Intl.DateTimeFormat("en", {
                      dateStyle: "medium",
                    }).format(request.requestedAt)}
                  </p>
                  {request.message ? (
                    <p className="mt-3 text-sm leading-6 text-amber-950">
                      {request.message}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["accepted", "rejected"] as const).map((decision) => (
                      <form
                        key={decision}
                        action={reviewCoownershipRequestAction}
                      >
                        <input
                          type="hidden"
                          name="coursePageId"
                          value={detail.course.id}
                        />
                        <input
                          type="hidden"
                          name="courseSlug"
                          value={slug}
                        />
                        <input
                          type="hidden"
                          name="requestId"
                          value={request.id}
                        />
                        <button
                          name="decision"
                          value={decision}
                          className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                            decision === "accepted"
                              ? "bg-indigo-600 text-white"
                              : "border border-amber-300 bg-white text-amber-950"
                          }`}
                        >
                          {decision === "accepted" ? "Accept" : "Reject"}
                        </button>
                      </form>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
              No Visitors are waiting for Owner review.
            </p>
          )}
        </section>

        <section>
          <h2 className="font-bold">Members</h2>
          <ul className="mt-4 space-y-3">
            {detail.members.map((member) => {
              const role = effectiveCourseRole(member.role);
              return (
                <li
                  key={member.studentId}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{member.name}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {role === "owner"
                          ? "Owner"
                          : role === "coowner"
                            ? "Co-owner"
                            : "Visitor"}
                      </p>
                    </div>
                    {role === "coowner" ? (
                      <form action={updateCourseMemberAction}>
                        <input
                          type="hidden"
                          name="coursePageId"
                          value={detail.course.id}
                        />
                        <input
                          type="hidden"
                          name="courseSlug"
                          value={slug}
                        />
                        <input
                          type="hidden"
                          name="studentId"
                          value={member.studentId}
                        />
                        <input
                          type="hidden"
                          name="attendance"
                          value={member.attendance}
                        />
                        <button
                          name="role"
                          value="visitor"
                          className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold"
                        >
                          Demote to Visitor
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <InviteMemberForm coursePageId={detail.course.id} courseSlug={slug} />
    </div>
  );
}
