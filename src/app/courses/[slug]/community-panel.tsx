import Link from "next/link";

import {
  getCourseCommunity,
  getOpenCourseReports,
} from "@/lib/courses/community";

import { AttachmentForm } from "./attachment-form";
import {
  createCoursePostAction,
  createCourseReplyAction,
  moderateCourseContentAction,
  reportCourseContentAction,
  resolveCourseReportAction,
  toggleCourseReactionAction,
} from "./community-actions";

export async function CommunityPanel({
  coursePageId,
  courseSlug,
  canPost,
  canModerate,
  canReport,
}: {
  coursePageId: string;
  courseSlug: string;
  canPost: boolean;
  canModerate: boolean;
  canReport: boolean;
}) {
  const [posts, reports] = await Promise.all([
    getCourseCommunity(coursePageId, canModerate),
    canModerate ? getOpenCourseReports(coursePageId) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        {canPost ? (
          <form
            action={createCoursePostAction}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <CourseIdentity
              coursePageId={coursePageId}
              courseSlug={courseSlug}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">Start a conversation</h2>
              <select
                name="kind"
                defaultValue="discussion"
                className={inputClass}
                aria-label="Post type"
              >
                <option value="discussion">Discussion</option>
                <option value="resource">Resource</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>
            <input
              name="title"
              maxLength={180}
              placeholder="Title (optional)"
              aria-label="Post title"
              className={`${inputClass} mt-3 w-full`}
            />
            <textarea
              name="body"
              required
              maxLength={20_000}
              rows={4}
              placeholder="Share a question, clarification, or resource…"
              aria-label="Post body"
              className={`${inputClass} mt-2 w-full resize-y`}
            />
            <button
              type="submit"
              className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Publish post
            </button>
          </form>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Course members with contributor access can participate. Public
            readers can still follow the discussion.
          </div>
        )}

        {posts.map((post) => (
          <article
            key={post.id}
            className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-zinc-900 ${
              post.hiddenAt
                ? "border-dashed border-rose-300 opacity-75 dark:border-rose-900"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {post.authorName}
                  </span>
                  <span>·</span>
                  <time dateTime={post.createdAt.toISOString()}>
                    {post.createdAt.toLocaleDateString("en", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 capitalize dark:bg-zinc-800">
                    {post.kind}
                  </span>
                  {post.pinnedAt ? <span>📌 Pinned</span> : null}
                  {post.lockedAt ? <span>🔒 Locked</span> : null}
                  {post.hiddenAt ? <span>Hidden by moderator</span> : null}
                </div>
                {post.title ? (
                  <h2 className="mt-2 text-lg font-semibold">{post.title}</h2>
                ) : null}
              </div>
            </header>

            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {post.body}
            </p>

            <AttachmentList
              attachments={post.attachments}
              coursePageId={coursePageId}
              courseSlug={courseSlug}
              canReport={canReport}
              canModerate={canModerate}
            />
            {canPost && !post.hiddenAt ? (
              <AttachmentForm
                coursePageId={coursePageId}
                courseSlug={courseSlug}
                parentType="post"
                parentId={post.id}
              />
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <ReactionButtons
                targetType="post"
                targetId={post.id}
                reactions={post.reactions}
                canReact={canPost}
                coursePageId={coursePageId}
                courseSlug={courseSlug}
              />
              {canReport ? (
                <ReportForm
                  targetType="post"
                  targetId={post.id}
                  coursePageId={coursePageId}
                  courseSlug={courseSlug}
                />
              ) : null}
              {canModerate ? (
                <ModerationForm
                  targetType="post"
                  targetId={post.id}
                  hidden={post.hiddenAt !== null}
                  locked={post.lockedAt !== null}
                  coursePageId={coursePageId}
                  courseSlug={courseSlug}
                />
              ) : null}
            </div>

            <div className="mt-5 space-y-3 border-l-2 border-zinc-200 pl-4 dark:border-zinc-800">
              {post.replies.map((reply) => (
                <article
                  key={reply.id}
                  className={reply.hiddenAt ? "opacity-60" : undefined}
                >
                  <header className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {reply.authorName}
                    </span>
                    <span>·</span>
                    <time dateTime={reply.createdAt.toISOString()}>
                      {reply.createdAt.toLocaleDateString("en", {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                    {reply.hiddenAt ? <span>Hidden</span> : null}
                  </header>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                    {reply.body}
                  </p>
                  <AttachmentList
                    attachments={reply.attachments}
                    coursePageId={coursePageId}
                    courseSlug={courseSlug}
                    canReport={canReport}
                    canModerate={canModerate}
                  />
                  {canPost && !reply.hiddenAt ? (
                    <AttachmentForm
                      coursePageId={coursePageId}
                      courseSlug={courseSlug}
                      parentType="reply"
                      parentId={reply.id}
                    />
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ReactionButtons
                      targetType="reply"
                      targetId={reply.id}
                      reactions={reply.reactions}
                      canReact={canPost}
                      coursePageId={coursePageId}
                      courseSlug={courseSlug}
                    />
                    {canReport ? (
                      <ReportForm
                        targetType="reply"
                        targetId={reply.id}
                        coursePageId={coursePageId}
                        courseSlug={courseSlug}
                      />
                    ) : null}
                    {canModerate ? (
                      <ModerationForm
                        targetType="reply"
                        targetId={reply.id}
                        hidden={reply.hiddenAt !== null}
                        locked={false}
                        coursePageId={coursePageId}
                        courseSlug={courseSlug}
                      />
                    ) : null}
                  </div>
                </article>
              ))}

              {canPost && !post.lockedAt && !post.hiddenAt ? (
                <form action={createCourseReplyAction} className="flex gap-2">
                  <CourseIdentity
                    coursePageId={coursePageId}
                    courseSlug={courseSlug}
                  />
                  <input type="hidden" name="postId" value={post.id} />
                  <input
                    name="body"
                    required
                    maxLength={10_000}
                    placeholder="Write a reply…"
                    aria-label={`Reply to ${post.title || "post"}`}
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Reply
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}

        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
            <h2 className="font-semibold">No posts yet</h2>
            <p className="mt-1 text-sm text-zinc-500">
              The first useful question can save the next student hours.
            </p>
          </div>
        ) : null}
      </div>

      <aside className="h-fit rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="font-semibold">Community guidelines</h2>
        <ul className="mt-3 space-y-2 text-zinc-600 dark:text-zinc-400">
          <li>Keep posts specific to this course.</li>
          <li>Share your own notes or permitted material.</li>
          <li>Report personal data and copyrighted leaks.</li>
          <li>Uploaded binaries stay outside Postgres.</li>
        </ul>
        {canModerate ? (
          <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <h3 className="font-semibold">
              Open reports{" "}
              <span className="text-xs text-zinc-500">({reports.length})</span>
            </h3>
            {reports.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {reports.map((report) => (
                  <li
                    key={report.id}
                    className="rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950"
                  >
                    <p className="font-medium capitalize">
                      {report.targetType.replace("_", " ")} · {report.reason}
                    </p>
                    <p className="mt-1 text-zinc-500">
                      Reported by {report.reporterName}
                    </p>
                    {report.details ? (
                      <p className="mt-2 line-clamp-3 text-zinc-600 dark:text-zinc-400">
                        {report.details}
                      </p>
                    ) : null}
                    <form
                      action={resolveCourseReportAction}
                      className="mt-2 flex gap-1"
                    >
                      <CourseIdentity
                        coursePageId={coursePageId}
                        courseSlug={courseSlug}
                      />
                      <input
                        type="hidden"
                        name="reportId"
                        value={report.id}
                      />
                      <button
                        type="submit"
                        name="resolution"
                        value="actioned"
                        className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700"
                      >
                        Actioned
                      </button>
                      <button
                        type="submit"
                        name="resolution"
                        value="dismissed"
                        className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700"
                      >
                        Dismiss
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Queue is clear.</p>
            )}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function AttachmentList({
  attachments,
  coursePageId,
  courseSlug,
  canReport,
  canModerate,
}: {
  attachments: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    access: "public" | "course";
  }[];
  coursePageId: string;
  courseSlug: string;
  canReport: boolean;
  canModerate: boolean;
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <li key={attachment.id} className="flex flex-wrap items-center gap-1">
          <Link
            href={`/api/courses/${coursePageId}/attachments/${attachment.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium hover:border-indigo-300 hover:text-indigo-700 dark:border-zinc-700 dark:hover:text-indigo-300"
          >
            <span aria-hidden>↧</span>
            <span>{attachment.fileName}</span>
            <span className="text-zinc-400">
              {formatBytes(attachment.sizeBytes)}
            </span>
            {attachment.access === "course" ? (
              <span aria-label="Members only">🔒</span>
            ) : null}
          </Link>
          {canReport ? (
            <ReportForm
              targetType="attachment"
              targetId={attachment.id}
              coursePageId={coursePageId}
              courseSlug={courseSlug}
            />
          ) : null}
          {canModerate ? (
            <ModerationForm
              targetType="attachment"
              targetId={attachment.id}
              hidden={false}
              locked={false}
              coursePageId={coursePageId}
              courseSlug={courseSlug}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ReactionButtons({
  targetType,
  targetId,
  reactions,
  canReact,
  coursePageId,
  courseSlug,
}: {
  targetType: "post" | "reply";
  targetId: string;
  reactions: { kind: "like" | "helpful" | "insightful"; value: number }[];
  canReact: boolean;
  coursePageId: string;
  courseSlug: string;
}) {
  const labels = {
    like: "Like",
    helpful: "Helpful",
    insightful: "Insightful",
  } as const;
  return (
    <>
      {(["like", "helpful", "insightful"] as const).map((kind) => {
        const value =
          Number(reactions.find((reaction) => reaction.kind === kind)?.value) ||
          0;
        return canReact ? (
          <form key={kind} action={toggleCourseReactionAction}>
            <CourseIdentity
              coursePageId={coursePageId}
              courseSlug={courseSlug}
            />
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            <button
              type="submit"
              name="kind"
              value={kind}
              className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs hover:bg-indigo-100 dark:bg-zinc-800 dark:hover:bg-indigo-950"
            >
              {labels[kind]} {value > 0 ? value : ""}
            </button>
          </form>
        ) : value > 0 ? (
          <span
            key={kind}
            className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800"
          >
            {labels[kind]} {value}
          </span>
        ) : null;
      })}
    </>
  );
}

function ReportForm({
  targetType,
  targetId,
  coursePageId,
  courseSlug,
}: {
  targetType: "post" | "reply" | "attachment";
  targetId: string;
  coursePageId: string;
  courseSlug: string;
}) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer rounded-full px-2.5 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
        Report
      </summary>
      <form
        action={reportCourseContentAction}
        className="mt-2 grid min-w-56 gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
      >
        <CourseIdentity
          coursePageId={coursePageId}
          courseSlug={courseSlug}
        />
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <select name="reason" defaultValue="spam" className={inputClass}>
          <option value="spam">Spam</option>
          <option value="harassment">Harassment</option>
          <option value="unsafe">Unsafe content</option>
          <option value="copyright">Copyright concern</option>
          <option value="other">Other</option>
        </select>
        <input
          name="details"
          maxLength={2000}
          placeholder="Optional details"
          className={inputClass}
        />
        <button
          type="submit"
          className="rounded-lg border border-zinc-300 px-3 py-2 font-semibold dark:border-zinc-700"
        >
          Send report
        </button>
      </form>
    </details>
  );
}

function ModerationForm({
  targetType,
  targetId,
  hidden,
  locked,
  coursePageId,
  courseSlug,
}: {
  targetType: "post" | "reply" | "attachment";
  targetId: string;
  hidden: boolean;
  locked: boolean;
  coursePageId: string;
  courseSlug: string;
}) {
  return (
    <form action={moderateCourseContentAction} className="flex gap-1">
      <CourseIdentity
        coursePageId={coursePageId}
        courseSlug={courseSlug}
      />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="reason" value="Course moderator action" />
      <button
        type="submit"
        name="action"
        value={hidden ? "restore" : "hide"}
        className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700"
      >
        {hidden ? "Restore" : "Hide"}
      </button>
      {targetType === "post" ? (
        <button
          type="submit"
          name="action"
          value={locked ? "unlock" : "lock"}
          className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs dark:border-zinc-700"
        >
          {locked ? "Unlock" : "Lock"}
        </button>
      ) : null}
    </form>
  );
}

function CourseIdentity({
  coursePageId,
  courseSlug,
}: {
  coursePageId: string;
  courseSlug: string;
}) {
  return (
    <>
      <input type="hidden" name="coursePageId" value={coursePageId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
    </>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${Math.round(bytes / 1_024)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950";
