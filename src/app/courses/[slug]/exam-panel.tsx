import Link from "next/link";

import { getCourseExam } from "@/lib/courses/exam";
import { getCourseCurriculumIndex } from "@/lib/courses/curriculum";
import { getI18n } from "@/lib/i18n/server";

import { AttachmentForm } from "./attachment-form";
import { ExamQuestionForm } from "./exam-question-form";
import {
  createExamExperienceAction,
  reportQuestionOccurrenceAction,
  requestQuestionMergeAction,
  reviewQuestionMergeAction,
  saveExamProfileAction,
  setExamContentHiddenAction,
  voteExamQuestionAction,
} from "./exam-actions";

export async function ExamPanel({
  coursePageId,
  courseSlug,
  canPost,
  canModerate,
}: {
  coursePageId: string;
  courseSlug: string;
  canPost: boolean;
  canModerate: boolean;
}) {
  const [exam, curriculum, i18n] = await Promise.all([
    getCourseExam(coursePageId, canModerate),
    getCourseCurriculumIndex(coursePageId, "published"),
    getI18n(),
  ]);
  const { t, formatDate } = i18n;
  const topics = (curriculum?.topics ?? [])
    .filter((topic) => topic.hiddenAt === null)
    .map((topic) => ({ stableId: topic.stableId, name: topic.name }));
  const subtopics = (curriculum?.topics ?? []).flatMap((topic) =>
    topic.hiddenAt
      ? []
      : topic.subtopics
          .filter((subtopic) => subtopic.hiddenAt === null)
          .map((subtopic) => ({
            stableId: subtopic.stableId,
            name: subtopic.name,
            topicName: topic.name,
          })),
  );
  const tierOrder = new Map<string | null, number>([
    ["S", 0],
    ["A", 1],
    ["B", 2],
    ["C", 3],
    ["D", 4],
    [null, 5],
  ]);
  const questions = exam.questions.toSorted(
    (left, right) =>
      (tierOrder.get(left.rank.tier) ?? 5) -
        (tierOrder.get(right.rank.tier) ?? 5) ||
      right.rank.score - left.rank.score,
  );
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
              {t("exam.profile")}
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              {t("exam.howExamined")}
            </h2>
          </div>
          {exam.profile?.updatedAt ? (
            <span className="text-xs text-zinc-500">
              {t("common.updated", {
                date: formatDate(exam.profile.updatedAt),
              })}
            </span>
          ) : null}
        </div>

        {canPost ? (
          <form
            action={saveExamProfileAction}
            className="mt-5 grid gap-3 sm:grid-cols-2"
          >
            <CourseIdentity
              coursePageId={coursePageId}
              courseSlug={courseSlug}
            />
            <label className="text-xs font-medium">
              {t("exam.assessmentType")}
              <select
                name="assessmentType"
                defaultValue={exam.profile?.assessmentType ?? ""}
                className={`${inputClass} mt-1 w-full`}
              >
                <option value="">{t("common.unknown")}</option>
                <option value="written">{t("exam.written")}</option>
                <option value="oral">{t("exam.oral")}</option>
                <option value="practical">{t("exam.practical")}</option>
                <option value="project">{t("exam.project")}</option>
                <option value="mixed">{t("exam.mixed")}</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              {t("exam.format")}
              <input
                name="format"
                defaultValue={exam.profile?.format ?? ""}
                maxLength={500}
                placeholder={t("exam.formatPlaceholder")}
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <label className="text-xs font-medium">
              {t("exam.gradingScale")}
              <input
                name="gradingScale"
                defaultValue={exam.profile?.gradingScale ?? ""}
                maxLength={120}
                placeholder={t("exam.gradingPlaceholder")}
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <label className="text-xs font-medium">
              {t("exam.lastVerifiedYear")}
              <input
                name="lastVerifiedAcademicYear"
                defaultValue={exam.profile?.lastVerifiedAcademicYear ?? ""}
                maxLength={20}
                placeholder={t("exam.yearPlaceholder")}
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <label className="text-xs font-medium">
              {t("exam.durationMinutes")}
              <input
                name="durationMinutes"
                type="number"
                min={1}
                max={1440}
                defaultValue={exam.profile?.durationMinutes ?? ""}
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="openBook"
                value="yes"
                defaultChecked={exam.profile?.openBook ?? false}
                className="accent-indigo-600"
              />
              {t("exam.openBook")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="calculatorAllowed"
                value="yes"
                defaultChecked={exam.profile?.calculatorAllowed ?? false}
                className="accent-indigo-600"
              />
              {t("exam.calculatorAllowed")}
            </label>
            <label className="text-xs font-medium sm:col-span-2">
              {t("exam.details")}
              <textarea
                name="details"
                rows={3}
                maxLength={4000}
                defaultValue={exam.profile?.details ?? ""}
                placeholder={t("exam.detailsPlaceholder")}
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <button
              type="submit"
              className="justify-self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              {t("exam.saveProfile")}
            </button>
          </form>
        ) : exam.profile ? (
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <Metadata
              label={t("exam.type")}
              value={exam.profile.assessmentType || t("common.unknown")}
            />
            <Metadata
              label={t("exam.format")}
              value={exam.profile.format || t("course.notSpecified")}
            />
            <Metadata
              label={t("exam.duration")}
              value={
                exam.profile.durationMinutes
                  ? t("exam.minutes", {
                      count: exam.profile.durationMinutes,
                    })
                  : t("course.notSpecified")
              }
            />
            <Metadata
              label={t("exam.grading")}
              value={exam.profile.gradingScale || t("course.notSpecified")}
            />
            <Metadata
              label={t("exam.lastVerified")}
              value={
                exam.profile.lastVerifiedAcademicYear ||
                t("course.notSpecified")
              }
            />
            <Metadata
              label={t("exam.openBook")}
              value={
                exam.profile.openBook == null
                  ? t("common.unknown")
                  : exam.profile.openBook
                    ? t("common.yes")
                    : t("common.no")
              }
            />
            <Metadata
              label={t("exam.calculator")}
              value={
                exam.profile.calculatorAllowed == null
                  ? t("common.unknown")
                  : exam.profile.calculatorAllowed
                    ? t("common.allowed")
                    : t("common.notAllowed")
              }
            />
            {exam.profile.details ? (
              <div className="sm:col-span-3">
                <dt className="text-zinc-500">{t("exam.details")}</dt>
                <dd className="mt-1 whitespace-pre-wrap leading-6">
                  {exam.profile.details}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">{t("exam.noProfile")}</p>
        )}
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          {t("exam.studentReported")}
          {exam.profile?.verificationCount
            ? ` · ${
                exam.profile.verificationCount === 1
                  ? t("exam.verificationOne")
                  : t("exam.verifications", {
                      count: exam.profile.verificationCount,
                    })
              }`
            : ""}
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("exam.materials")}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {t("exam.materialsHelp")}
            </p>
          </div>
          {canPost ? (
            <Link
              href={`/courses/${courseSlug}?tab=resources`}
              className="inline-flex min-h-11 items-center rounded-xl bg-indigo-50 px-3 text-sm font-semibold text-indigo-700"
            >
              {t("exam.addResources")}
            </Link>
          ) : null}
        </div>
        {exam.materials.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {exam.materials.map((material) => (
              <li
                key={material.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <h3 className="font-semibold">
                  {material.title || t("exam.permittedMaterial")}
                </h3>
                {material.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {material.body}
                  </p>
                ) : null}
                {material.linkUrl ? (
                  <Link
                    href={material.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-2 inline-flex min-h-11 items-center break-all text-sm font-semibold text-indigo-700 underline"
                  >
                    {t("exam.openMaterial")}
                  </Link>
                ) : null}
                <ExamAttachmentList
                  attachments={material.attachments}
                  coursePageId={coursePageId}
                />
                <p className="mt-2 text-[11px] text-zinc-500">
                  {t("exam.permissionBy", { name: material.authorName })}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">
            {t("exam.noMaterials")}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">{t("exam.experiences")}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {t("exam.experienceHelp")}
          </p>
          {canPost ? (
            <form
              action={createExamExperienceAction}
              className="mt-4 grid gap-2 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-950"
            >
              <CourseIdentity
                coursePageId={coursePageId}
                courseSlug={courseSlug}
              />
              <input
                name="title"
                required
                maxLength={180}
                placeholder={t("exam.experienceTitle")}
                aria-label={t("exam.experienceTitle")}
                className={inputClass}
              />
              <textarea
                name="body"
                required
                maxLength={20_000}
                rows={4}
                placeholder={t("exam.experiencePlaceholder")}
                aria-label={t("exam.experience")}
                className={inputClass}
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  name="academicYear"
                  maxLength={20}
                  placeholder="2026/27"
                  aria-label={t("exam.academicYear")}
                  className={inputClass}
                />
                <input
                  name="examDate"
                  type="date"
                  aria-label={t("exam.examDate")}
                  className={inputClass}
                />
                <input
                  name="grade"
                  maxLength={40}
                  placeholder={t("exam.gradeOptional")}
                  aria-label={t("exam.grade")}
                  className={inputClass}
                />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  name="anonymous"
                  value="yes"
                  className="accent-indigo-600"
                />
                {t("exam.anonymous")}
              </label>
              <button
                type="submit"
                className="justify-self-start rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                {t("exam.addExperience")}
              </button>
            </form>
          ) : null}

          <ul className="mt-4 space-y-3">
            {exam.experiences.map((experience) => (
              <li
                key={experience.id}
                className={`rounded-xl border p-4 ${
                  experience.hiddenAt
                    ? "border-dashed border-rose-300 opacity-70 dark:border-rose-900"
                    : "border-zinc-200 dark:border-zinc-800"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{experience.title}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {experience.anonymous
                        ? t("exam.anonymousContributor")
                        : experience.authorName}
                      {experience.academicYear
                        ? ` · ${experience.academicYear}`
                        : ""}
                      {experience.grade
                        ? ` · ${t("exam.gradeValue", {
                            grade: experience.grade,
                          })}`
                        : ""}
                    </p>
                  </div>
                  {canModerate ? (
                    <HideExamContentForm
                      targetType="exam_experience"
                      targetId={experience.id}
                      hidden={experience.hiddenAt !== null}
                      coursePageId={coursePageId}
                      courseSlug={courseSlug}
                    />
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {experience.body}
                </p>
                <ExamAttachmentList
                  attachments={experience.attachments}
                  coursePageId={coursePageId}
                />
                {canPost && !experience.hiddenAt ? (
                  <AttachmentForm
                    coursePageId={coursePageId}
                    courseSlug={courseSlug}
                    parentType="exam_experience"
                    parentId={experience.id}
                  />
                ) : null}
              </li>
            ))}
          </ul>
          {exam.experiences.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">
              {t("exam.noExperiences")}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">{t("exam.confidence")}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {t("exam.confidenceHelp")}
          </p>

          {canPost ? (
            <ExamQuestionForm
              coursePageId={coursePageId}
              courseSlug={courseSlug}
              topics={topics}
              subtopics={subtopics}
            />
          ) : null}
        </section>
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{t("exam.questionBank")}</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {t("exam.questionBankHelp")}
            </p>
          </div>
          <span className="text-sm text-zinc-500">
            {questions.length === 1
              ? t("exam.questionOne")
              : t("exam.questionCount", { count: questions.length })}
          </span>
        </div>

        <ol className="mt-4 space-y-4">
          {questions.map((question) => (
            <li
              key={question.id}
              id={`question-${question.id}`}
              className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-zinc-900 ${
                question.hiddenAt
                  ? "border-dashed border-rose-300 opacity-70 dark:border-rose-900"
                  : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="flex items-start gap-4">
                <TierBadge
                  tier={question.rank.tier}
                  sufficient={question.rank.sufficient}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="whitespace-pre-wrap font-medium leading-6">
                        {question.prompt}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {t("exam.addedBy", { name: question.creatorName })}
                        {question.questionType
                          ? ` · ${question.questionType.replaceAll("_", " ")}`
                          : ""}
                        {question.difficulty
                          ? ` · ${t("exam.difficultyValue", {
                              value: question.difficulty,
                            })}`
                          : ""}
                      </p>
                    </div>
                    {canModerate ? (
                      <HideExamContentForm
                        targetType="exam_question"
                        targetId={question.id}
                        hidden={question.hiddenAt !== null}
                        coursePageId={coursePageId}
                        courseSlug={courseSlug}
                      />
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      {t("exam.reports", {
                        count: question.evidence.occurrences,
                      })}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      {t("exam.sessions", {
                        count: question.evidence.distinctSessions,
                      })}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      {t("exam.contributors", {
                        count: question.evidence.distinctContributors,
                      })}
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      {t("exam.votes", {
                        count: `${question.evidence.netVotes >= 0 ? "+" : ""}${question.evidence.netVotes}`,
                      })}
                    </span>
                  </div>

                  {question.answerGuidance ? (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer font-medium text-indigo-600 dark:text-indigo-400">
                        {t("exam.showGuidance")}
                      </summary>
                      <p className="mt-2 whitespace-pre-wrap leading-6 text-zinc-600 dark:text-zinc-400">
                        {question.answerGuidance}
                      </p>
                    </details>
                  ) : null}

                  <ExamAttachmentList
                    attachments={question.attachments}
                    coursePageId={coursePageId}
                  />
                  {canPost && !question.hiddenAt ? (
                    <AttachmentForm
                      coursePageId={coursePageId}
                      courseSlug={courseSlug}
                      parentType="exam_question"
                      parentId={question.id}
                    />
                  ) : null}

                  {question.occurrences.length > 0 ? (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer text-zinc-500">
                        {t("exam.occurrenceEvidence")}
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {question.occurrences.map((occurrence) => (
                          <li
                            key={occurrence.id}
                            className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-950"
                          >
                            {occurrence.sessionLabel}
                            {occurrence.occurredOn
                              ? ` · ${occurrence.occurredOn}`
                              : ""}
                            {occurrence.professorName
                              ? ` · Prof. ${occurrence.professorName}`
                              : ""}
                            {occurrence.notes ? ` · ${occurrence.notes}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  {canPost ? (
                    <div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800 lg:grid-cols-2">
                      <form
                        action={reportQuestionOccurrenceAction}
                        className="grid gap-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-950"
                      >
                        <CourseIdentity
                          coursePageId={coursePageId}
                          courseSlug={courseSlug}
                        />
                        <input
                          type="hidden"
                          name="questionId"
                          value={question.id}
                        />
                        <input
                          name="sessionLabel"
                          required
                          maxLength={120}
                          placeholder={t("exam.sessionPlaceholder")}
                          aria-label={t("exam.session")}
                          className={inputClass}
                        />
                        <input
                          name="occurredOn"
                          type="date"
                          aria-label={t("exam.occurrenceDate")}
                          className={inputClass}
                        />
                        <input
                          name="notes"
                          maxLength={2000}
                          placeholder={t("exam.occurrenceNotesPlaceholder")}
                          aria-label={t("exam.occurrenceNotes")}
                          className={inputClass}
                        />
                        <input
                          name="professorName"
                          maxLength={120}
                          placeholder={t("exam.professorOptional")}
                          aria-label={t("course.professor")}
                          className={inputClass}
                        />
                        <button
                          type="submit"
                          className="justify-self-start rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold dark:border-zinc-700"
                        >
                          {t("exam.reportOccurrence")}
                        </button>
                      </form>

                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {[
                            [1, t("exam.useful")],
                            [-1, t("exam.notUseful")],
                          ].map(([value, label]) => (
                            <form key={value} action={voteExamQuestionAction}>
                              <CourseIdentity
                                coursePageId={coursePageId}
                                courseSlug={courseSlug}
                              />
                              <input
                                type="hidden"
                                name="questionId"
                                value={question.id}
                              />
                              <button
                                type="submit"
                                name="value"
                                value={value}
                                className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-medium dark:border-zinc-700"
                              >
                                {label}
                              </button>
                            </form>
                          ))}
                        </div>

                        {questions.length > 1 ? (
                          <form
                            action={requestQuestionMergeAction}
                            className="grid gap-2"
                          >
                            <CourseIdentity
                              coursePageId={coursePageId}
                              courseSlug={courseSlug}
                            />
                            <input
                              type="hidden"
                              name="sourceQuestionId"
                              value={question.id}
                            />
                            <select
                              name="targetQuestionId"
                              required
                              defaultValue=""
                              aria-label={t("exam.mergeTarget")}
                              className={inputClass}
                            >
                              <option value="" disabled>
                                {t("exam.suggestDuplicate")}
                              </option>
                              {questions
                                .filter(
                                  (candidate) => candidate.id !== question.id,
                                )
                                .map((candidate) => (
                                  <option
                                    key={candidate.id}
                                    value={candidate.id}
                                  >
                                    {candidate.prompt.slice(0, 80)}
                                  </option>
                                ))}
                            </select>
                            <input
                              name="rationale"
                              required
                              minLength={4}
                              maxLength={2000}
                              placeholder={t("exam.mergeWhy")}
                              aria-label={t("exam.mergeRationale")}
                              className={inputClass}
                            />
                            <button
                              type="submit"
                              className="justify-self-start rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold dark:border-zinc-700"
                            >
                              {t("exam.requestMerge")}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {questions.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {t("exam.noQuestions")}
          </p>
        ) : null}
      </section>

      {canModerate && exam.mergeRequests.length > 0 ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-semibold">{t("exam.openMerges")}</h2>
          <ul className="mt-3 space-y-3">
            {exam.mergeRequests.map((request) => {
              const source = questionById.get(request.sourceQuestionId);
              const target = questionById.get(request.targetQuestionId);
              return (
                <li
                  key={request.id}
                  className="rounded-xl bg-white p-4 text-sm dark:bg-zinc-900"
                >
                  <p>
                    <strong>{t("exam.source")}</strong>{" "}
                    {source?.prompt || request.sourceQuestionId}
                  </p>
                  <p className="mt-1">
                    <strong>{t("exam.target")}</strong>{" "}
                    {target?.prompt || request.targetQuestionId}
                  </p>
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                    {request.rationale}
                  </p>
                  <form
                    action={reviewQuestionMergeAction}
                    className="mt-3 flex gap-2"
                  >
                    <CourseIdentity
                      coursePageId={coursePageId}
                      courseSlug={courseSlug}
                    />
                    <input
                      type="hidden"
                      name="mergeRequestId"
                      value={request.id}
                    />
                    <button
                      type="submit"
                      name="decision"
                      value="accepted"
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      {t("exam.acceptMerge")}
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="rejected"
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold dark:border-zinc-700"
                    >
                      {t("common.reject")}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

async function TierBadge({
  tier,
  sufficient,
}: {
  tier: "S" | "A" | "B" | "C" | "D" | null;
  sufficient: boolean;
}) {
  const { t } = await getI18n();
  if (!sufficient || !tier) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-center text-[10px] font-semibold leading-tight text-zinc-500 dark:bg-zinc-800">
        {t("exam.notEnough")}
      </span>
    );
  }
  const colors = {
    S: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
    A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    B: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    C: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    D: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  };
  return (
    <span
      aria-label={t("exam.tier", { tier })}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl font-black ${colors[tier]}`}
    >
      {tier}
    </span>
  );
}

function ExamAttachmentList({
  attachments,
  coursePageId,
}: {
  attachments: {
    id: string;
    fileName: string;
    sizeBytes: number;
    access: "public" | "course";
  }[];
  coursePageId: string;
}) {
  if (attachments.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <li key={attachment.id}>
          <a
            href={`/api/courses/${coursePageId}/attachments/${attachment.id}`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium hover:border-indigo-300 dark:border-zinc-700"
          >
            ↧ {attachment.fileName}
            <span className="text-zinc-400">
              {formatBytes(attachment.sizeBytes)}
            </span>
            {attachment.access === "course" ? " 🔒" : ""}
          </a>
        </li>
      ))}
    </ul>
  );
}

async function HideExamContentForm({
  targetType,
  targetId,
  hidden,
  coursePageId,
  courseSlug,
}: {
  targetType: "exam_experience" | "exam_question";
  targetId: string;
  hidden: boolean;
  coursePageId: string;
  courseSlug: string;
}) {
  const { t } = await getI18n();
  return (
    <form action={setExamContentHiddenAction}>
      <CourseIdentity coursePageId={coursePageId} courseSlug={courseSlug} />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <button
        type="submit"
        name="hidden"
        value={hidden ? "no" : "yes"}
        className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs dark:border-zinc-700"
      >
        {hidden ? t("common.restore") : t("common.hide")}
      </button>
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

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium capitalize">{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${Math.round(bytes / 1_024)} KB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

const inputClass =
  "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950";
