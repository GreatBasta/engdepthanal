import Link from "next/link";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { getCourseCurriculumIndex } from "@/lib/courses/curriculum";
import { db } from "@/lib/db/client";
import {
  courseAttachments,
  courseResourceComments,
  courseResourceReactions,
  courseResources,
  students,
} from "@/lib/db/schema";
import { getI18n } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/messages";

import { AttachmentForm } from "./attachment-form";
import {
  moderateCourseContentAction,
  reportCourseContentAction,
} from "./community-actions";
import {
  createResourceAction,
  createResourceCommentAction,
  toggleResourceReactionAction,
} from "./resource-actions";

type ReactionKind = "like" | "helpful" | "insightful";

const reactionLabels: Record<
  ReactionKind,
  { emoji: string; key: TranslationKey }
> = {
  like: { emoji: "👍", key: "resources.useful" },
  helpful: { emoji: "✅", key: "resources.helpful" },
  insightful: { emoji: "💡", key: "resources.insightful" },
};

const resourceTypeKeys: Record<string, TranslationKey> = {
  text_note: "resources.textNote",
  study_tip: "resources.studyTip",
  correction: "resources.correction",
  link: "resources.link",
  personal_notes: "resources.personalNotes",
  permitted_material: "resources.permittedMaterial",
};

export async function ResourcesPanel({
  coursePageId,
  courseSlug,
  canPost,
  canModerate,
  page = 1,
  selectedSubtopic,
}: {
  coursePageId: string;
  courseSlug: string;
  canPost: boolean;
  canModerate: boolean;
  page?: number;
  selectedSubtopic?: string;
}) {
  const { t } = await getI18n();
  const safePage = Math.max(1, Math.floor(page));
  const filters = [
    eq(courseResources.coursePageId, coursePageId),
    isNull(courseResources.hiddenAt),
    isNull(courseResources.deletedAt),
  ];
  if (selectedSubtopic) {
    filters.push(eq(courseResources.courseSubtopicStableId, selectedSubtopic));
  }

  const [curriculum, resources] = await Promise.all([
    getCourseCurriculumIndex(coursePageId, "published"),
    db
      .select({
        id: courseResources.id,
        type: courseResources.type,
        context: courseResources.context,
        topicStableId: courseResources.courseTopicStableId,
        subtopicStableId: courseResources.courseSubtopicStableId,
        title: courseResources.title,
        body: courseResources.body,
        linkUrl: courseResources.linkUrl,
        createdAt: courseResources.createdAt,
        author: students.displayName,
      })
      .from(courseResources)
      .innerJoin(students, eq(courseResources.authorId, students.id))
      .where(and(...filters))
      .orderBy(desc(courseResources.createdAt))
      .limit(20)
      .offset((safePage - 1) * 20),
  ]);
  const topics = (curriculum?.topics ?? []).filter(
    (topic) => topic.hiddenAt === null,
  );
  const subtopics = topics.flatMap((topic) =>
    topic.subtopics
      .filter((subtopic) => subtopic.hiddenAt === null)
      .map((subtopic) => ({
        stableId: subtopic.stableId,
        name: subtopic.name,
        topicName: topic.name,
      })),
  );
  const selectedSubtopicInfo = subtopics.find(
    (subtopic) => subtopic.stableId === selectedSubtopic,
  );

  const resourceIds = resources.map((resource) => resource.id);
  const [attachments, comments, reactionRows] = resourceIds.length
    ? await Promise.all([
        db
          .select({
            id: courseAttachments.id,
            parentId: courseAttachments.parentId,
            fileName: courseAttachments.fileName,
            mimeType: courseAttachments.mimeType,
            sizeBytes: courseAttachments.sizeBytes,
          })
          .from(courseAttachments)
          .where(
            and(
              eq(courseAttachments.coursePageId, coursePageId),
              eq(courseAttachments.parentType, "course_resource"),
              inArray(courseAttachments.parentId, resourceIds),
              isNull(courseAttachments.deletedAt),
            ),
          ),
        db
          .select({
            id: courseResourceComments.id,
            resourceId: courseResourceComments.resourceId,
            body: courseResourceComments.body,
            createdAt: courseResourceComments.createdAt,
            author: students.displayName,
          })
          .from(courseResourceComments)
          .innerJoin(students, eq(courseResourceComments.authorId, students.id))
          .where(
            and(
              inArray(courseResourceComments.resourceId, resourceIds),
              isNull(courseResourceComments.hiddenAt),
            ),
          )
          .orderBy(courseResourceComments.createdAt),
        db
          .select({
            resourceId: courseResourceReactions.resourceId,
            kind: courseResourceReactions.kind,
            value: count(),
          })
          .from(courseResourceReactions)
          .where(inArray(courseResourceReactions.resourceId, resourceIds))
          .groupBy(
            courseResourceReactions.resourceId,
            courseResourceReactions.kind,
          ),
      ])
    : [[], [], []];

  const topicByStableId = new Map(
    topics.map((topic) => [topic.stableId, topic.name]),
  );
  const subtopicByStableId = new Map(
    subtopics.map((subtopic) => [
      subtopic.stableId,
      `${subtopic.topicName} · ${subtopic.name}`,
    ]),
  );
  const commentsByResource = new Map<string, (typeof comments)[number][]>();
  for (const comment of comments) {
    const values = commentsByResource.get(comment.resourceId) ?? [];
    values.push(comment);
    commentsByResource.set(comment.resourceId, values);
  }
  const attachmentsByResource = new Map<
    string,
    (typeof attachments)[number][]
  >();
  for (const attachment of attachments) {
    if (!attachment.parentId) continue;
    const values = attachmentsByResource.get(attachment.parentId) ?? [];
    values.push(attachment);
    attachmentsByResource.set(attachment.parentId, values);
  }
  const reactionCountByKey = new Map(
    reactionRows.map((reaction) => [
      `${reaction.resourceId}:${reaction.kind}`,
      Number(reaction.value),
    ]),
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">{t("resources.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("resources.subtitle")}
            </p>
          </div>
          <span className="text-xs text-slate-500">{t("resources.sort")}</span>
        </div>

        {selectedSubtopicInfo ? (
          <div
            role="region"
            aria-label={t("resources.selectedSubtopic")}
            className="sticky top-16 z-20 mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  {t("resources.subtopicResources")}
                </p>
                <h3 className="mt-1 font-bold text-indigo-950">
                  {selectedSubtopicInfo.name}
                </h3>
                <p className="text-xs text-indigo-700">
                  {selectedSubtopicInfo.topicName}
                </p>
              </div>
              <Link
                href={`/courses/${courseSlug}?tab=resources`}
                className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-indigo-800"
              >
                {t("resources.close")}
              </Link>
            </div>
          </div>
        ) : null}

        {resources.length ? (
          <ul className="mt-5 space-y-3">
            {resources.map((resource) => {
              const resourceComments =
                commentsByResource.get(resource.id) ?? [];
              const resourceAttachments =
                attachmentsByResource.get(resource.id) ?? [];
              const contextLabel =
                resource.context === "topic" && resource.topicStableId
                  ? (topicByStableId.get(resource.topicStableId) ??
                    t("resources.topic"))
                  : resource.context === "subtopic" && resource.subtopicStableId
                    ? (subtopicByStableId.get(resource.subtopicStableId) ??
                      t("resources.subtopic"))
                    : resource.context === "exam"
                      ? t("course.exam")
                      : t("resources.wholeCourse");
              return (
                <li
                  key={resource.id}
                  className="render-lazy rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold capitalize text-indigo-700">
                      {t(
                        resourceTypeKeys[resource.type] ?? "resources.textNote",
                      )}
                    </span>
                    <span className="min-w-0 break-words text-slate-500">
                      {contextLabel}
                    </span>
                    <span className="text-slate-400">· {resource.author}</span>
                  </div>
                  {resource.title ? (
                    <h3 className="mt-3 font-bold">{resource.title}</h3>
                  ) : null}
                  {resource.body ? (
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                      {resource.body}
                    </p>
                  ) : null}
                  {resource.linkUrl ? (
                    <Link
                      href={resource.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="mt-3 inline-flex min-h-11 max-w-full items-center break-all text-sm font-semibold text-indigo-700 underline"
                    >
                      {t("resources.openLink")}
                    </Link>
                  ) : null}
                  {resourceAttachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
                    >
                      <a
                        href={`/api/courses/${coursePageId}/attachments/${attachment.id}`}
                        className="flex min-h-11 min-w-0 flex-1 items-center break-all rounded-xl bg-slate-100 px-3 text-sm font-semibold text-indigo-700"
                      >
                        {attachment.fileName} ·{" "}
                        {Math.ceil(attachment.sizeBytes / 1024)} KB
                      </a>
                      {canModerate ? (
                        <form action={moderateCourseContentAction}>
                          <input
                            type="hidden"
                            name="coursePageId"
                            value={coursePageId}
                          />
                          <input
                            type="hidden"
                            name="courseSlug"
                            value={courseSlug}
                          />
                          <input
                            type="hidden"
                            name="targetType"
                            value="attachment"
                          />
                          <input
                            type="hidden"
                            name="targetId"
                            value={attachment.id}
                          />
                          <input
                            type="hidden"
                            name="reason"
                            value="Hidden by course Owner"
                          />
                          <button
                            type="submit"
                            name="action"
                            value="hide"
                            className="min-h-11 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-700"
                          >
                            {t("resources.hideAttachment")}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ))}

                  <div
                    aria-label={t("resources.reactions")}
                    className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3"
                  >
                    {(Object.keys(reactionLabels) as ReactionKind[]).map(
                      (kind) => {
                        const value =
                          reactionCountByKey.get(`${resource.id}:${kind}`) ?? 0;
                        const reaction = reactionLabels[kind];
                        const label = t(reaction.key);
                        return canPost ? (
                          <form
                            key={kind}
                            action={toggleResourceReactionAction}
                          >
                            <ResourceIdentity
                              coursePageId={coursePageId}
                              courseSlug={courseSlug}
                              resourceId={resource.id}
                            />
                            <button
                              type="submit"
                              name="kind"
                              value={kind}
                              aria-label={t("resources.reactionCount", {
                                label,
                                count: value,
                              })}
                              className="min-h-11 rounded-full bg-slate-100 px-3 text-xs hover:bg-indigo-100"
                            >
                              <span aria-hidden>{reaction.emoji}</span>{" "}
                              {value || ""}
                            </button>
                          </form>
                        ) : value ? (
                          <span
                            key={kind}
                            className="inline-flex min-h-11 items-center rounded-full bg-slate-100 px-3 text-xs"
                            aria-label={t("resources.reactionCount", {
                              label,
                              count: value,
                            })}
                          >
                            <span aria-hidden>{reaction.emoji}</span>&nbsp;
                            {value}
                          </span>
                        ) : null;
                      },
                    )}
                  </div>

                  <details className="mt-3 rounded-xl bg-slate-50 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      {t("resources.comments", {
                        count: resourceComments.length || "",
                      })}
                    </summary>
                    {resourceComments.length ? (
                      <ul className="mt-3 space-y-2">
                        {resourceComments.map((comment) => (
                          <li
                            key={comment.id}
                            className="rounded-lg bg-white p-3 text-sm"
                          >
                            <p className="whitespace-pre-wrap break-words text-slate-700">
                              {comment.body}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {comment.author}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">
                        {t("resources.noComments")}
                      </p>
                    )}
                    {canPost ? (
                      <form
                        action={createResourceCommentAction}
                        className="mt-3 flex flex-col gap-2 sm:flex-row"
                      >
                        <ResourceIdentity
                          coursePageId={coursePageId}
                          courseSlug={courseSlug}
                          resourceId={resource.id}
                        />
                        <label
                          className="sr-only"
                          htmlFor={`comment-${resource.id}`}
                        >
                          {t("resources.shortComment")}
                        </label>
                        <input
                          id={`comment-${resource.id}`}
                          name="body"
                          required
                          maxLength={1_000}
                          placeholder={t("resources.commentPlaceholder")}
                          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3 text-sm"
                        />
                        <button className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white">
                          {t("resources.comment")}
                        </button>
                      </form>
                    ) : null}
                  </details>

                  {canPost ? (
                    <>
                      <AttachmentForm
                        coursePageId={coursePageId}
                        courseSlug={courseSlug}
                        parentType="course_resource"
                        parentId={resource.id}
                      />
                      <ResourceReportForm
                        coursePageId={coursePageId}
                        courseSlug={courseSlug}
                        resourceId={resource.id}
                      />
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            {selectedSubtopicInfo
              ? t("resources.emptySubtopic")
              : t("resources.emptyContextual")}
          </div>
        )}
        <nav aria-label={t("resources.pages")} className="mt-5 flex gap-3">
          {safePage > 1 ? (
            <Link
              href={resourcePageHref(
                courseSlug,
                safePage - 1,
                selectedSubtopicInfo?.stableId,
              )}
              className="min-h-11 px-3 py-2 font-semibold text-indigo-700"
            >
              {t("common.previous")}
            </Link>
          ) : null}
          {resources.length === 20 ? (
            <Link
              href={resourcePageHref(
                courseSlug,
                safePage + 1,
                selectedSubtopicInfo?.stableId,
              )}
              className="min-h-11 px-3 py-2 font-semibold text-indigo-700"
            >
              {t("common.next")}
            </Link>
          ) : null}
        </nav>
      </section>

      <aside>
        {canPost ? (
          <ResourceComposer
            coursePageId={coursePageId}
            courseSlug={courseSlug}
            topics={topics}
            subtopics={subtopics}
            selectedSubtopic={selectedSubtopicInfo?.stableId}
          />
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            {t("resources.joinHelp")}
          </div>
        )}
      </aside>
    </div>
  );
}

async function ResourceComposer({
  coursePageId,
  courseSlug,
  topics,
  subtopics,
  selectedSubtopic,
}: {
  coursePageId: string;
  courseSlug: string;
  topics: Array<{ stableId: string; name: string }>;
  subtopics: Array<{ stableId: string; name: string; topicName: string }>;
  selectedSubtopic?: string;
}) {
  const { t } = await getI18n();
  return (
    <form
      action={createResourceAction}
      className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="font-bold">{t("resources.add")}</h2>
      <input type="hidden" name="coursePageId" value={coursePageId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <label className="mt-4 block text-sm font-semibold">
        {t("resources.attachTo")}
        <select
          name="contextTarget"
          defaultValue={
            selectedSubtopic ? `subtopic:${selectedSubtopic}` : "course"
          }
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"
        >
          <option value="course">{t("resources.wholeCourse")}</option>
          <option value="exam">{t("course.exam")}</option>
          <optgroup label={t("resources.topics")}>
            {topics.map((topic) => (
              <option key={topic.stableId} value={`topic:${topic.stableId}`}>
                {topic.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("resources.subtopics")}>
            {subtopics.map((subtopic) => (
              <option
                key={subtopic.stableId}
                value={`subtopic:${subtopic.stableId}`}
              >
                {subtopic.topicName} · {subtopic.name}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className="mt-3 block text-sm font-semibold">
        {t("resources.type")}
        <select
          name="type"
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"
        >
          <option value="text_note">{t("resources.textNote")}</option>
          <option value="study_tip">{t("resources.studyTip")}</option>
          <option value="correction">{t("resources.correction")}</option>
          <option value="link">{t("resources.link")}</option>
          <option value="personal_notes">{t("resources.personalNotes")}</option>
          <option value="permitted_material">
            {t("resources.permittedMaterial")}
          </option>
        </select>
      </label>
      <label className="mt-3 block text-sm font-semibold">
        {t("resources.titleField")}
        <input
          name="title"
          maxLength={180}
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"
        />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        {t("resources.note")}
        <textarea
          name="body"
          rows={5}
          maxLength={10_000}
          className="mt-1 w-full rounded-xl border border-slate-300 p-3"
        />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        {t("resources.link")}
        <input
          name="linkUrl"
          type="url"
          className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3"
        />
      </label>
      <label className="mt-4 flex gap-3 text-xs leading-5 text-slate-600">
        <input
          type="checkbox"
          name="permissionConfirmed"
          value="yes"
          className="mt-1"
        />
        {t("resources.permission")}
      </label>
      <button className="mt-4 min-h-11 w-full rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white">
        {t("resources.publish")}
      </button>
    </form>
  );
}

function ResourceIdentity({
  coursePageId,
  courseSlug,
  resourceId,
}: {
  coursePageId: string;
  courseSlug: string;
  resourceId: string;
}) {
  return (
    <>
      <input type="hidden" name="coursePageId" value={coursePageId} />
      <input type="hidden" name="courseSlug" value={courseSlug} />
      <input type="hidden" name="resourceId" value={resourceId} />
    </>
  );
}

async function ResourceReportForm({
  coursePageId,
  courseSlug,
  resourceId,
}: {
  coursePageId: string;
  courseSlug: string;
  resourceId: string;
}) {
  const { t } = await getI18n();
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-slate-500">
        {t("resources.report")}
      </summary>
      <form
        action={reportCourseContentAction}
        className="mt-2 grid gap-2 rounded-xl border border-slate-200 p-3"
      >
        <input type="hidden" name="coursePageId" value={coursePageId} />
        <input type="hidden" name="courseSlug" value={courseSlug} />
        <input type="hidden" name="targetType" value="course_resource" />
        <input type="hidden" name="targetId" value={resourceId} />
        <label>
          {t("resources.reason")}
          <select
            name="reason"
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-2"
          >
            <option value="spam">{t("resources.spam")}</option>
            <option value="harassment">{t("resources.harassment")}</option>
            <option value="personal_info">{t("resources.personalInfo")}</option>
            <option value="copyright">{t("resources.copyright")}</option>
            <option value="unauthorized_exam_material">
              {t("resources.unauthorizedExam")}
            </option>
            <option value="incorrect_info">{t("resources.incorrect")}</option>
            <option value="inappropriate">
              {t("resources.inappropriate")}
            </option>
            <option value="other">{t("resources.other")}</option>
          </select>
        </label>
        <textarea
          name="details"
          rows={2}
          maxLength={2_000}
          aria-label={t("resources.reportDetails")}
          className="rounded-lg border border-slate-300 p-2"
        />
        <button className="min-h-11 rounded-lg border border-slate-300 font-semibold">
          {t("resources.submitReport")}
        </button>
      </form>
    </details>
  );
}

function resourcePageHref(courseSlug: string, page: number, subtopic?: string) {
  const params = new URLSearchParams({ tab: "resources", page: String(page) });
  if (subtopic) params.set("subtopic", subtopic);
  return `/courses/${courseSlug}?${params.toString()}`;
}
