import { getCourseExam } from "@/lib/courses/exam";

import { AttachmentForm } from "./attachment-form";
import {
  createExamExperienceAction,
  createExamQuestionAction,
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
  canEdit,
  canModerate,
}: {
  coursePageId: string;
  courseSlug: string;
  canPost: boolean;
  canEdit: boolean;
  canModerate: boolean;
}) {
  const exam = await getCourseExam(coursePageId, canModerate);
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
              Assessment profile
            </p>
            <h2 className="mt-1 text-xl font-semibold">
              How this course is examined
            </h2>
          </div>
          {exam.profile?.updatedAt ? (
            <span className="text-xs text-zinc-500">
              Updated{" "}
              {exam.profile.updatedAt.toLocaleDateString("en", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>

        {canEdit ? (
          <form
            action={saveExamProfileAction}
            className="mt-5 grid gap-3 sm:grid-cols-2"
          >
            <CourseIdentity
              coursePageId={coursePageId}
              courseSlug={courseSlug}
            />
            <label className="text-xs font-medium">
              Assessment type
              <select
                name="assessmentType"
                defaultValue={exam.profile?.assessmentType ?? ""}
                className={`${inputClass} mt-1 w-full`}
              >
                <option value="">Unknown</option>
                <option value="written">Written</option>
                <option value="oral">Oral</option>
                <option value="practical">Practical</option>
                <option value="project">Project</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
            <label className="text-xs font-medium">
              Format
              <input
                name="format"
                defaultValue={exam.profile?.format ?? ""}
                maxLength={500}
                placeholder="e.g. 3 exercises + oral follow-up"
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <label className="text-xs font-medium">
              Grading scale
              <input
                name="gradingScale"
                defaultValue={exam.profile?.gradingScale ?? ""}
                maxLength={120}
                placeholder="e.g. 0–30, pass at 18"
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <label className="text-xs font-medium">
              Duration (minutes)
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
              Open book
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="calculatorAllowed"
                value="yes"
                defaultChecked={exam.profile?.calculatorAllowed ?? false}
                className="accent-indigo-600"
              />
              Calculator allowed
            </label>
            <label className="text-xs font-medium sm:col-span-2">
              Details
              <textarea
                name="details"
                rows={3}
                maxLength={4000}
                defaultValue={exam.profile?.details ?? ""}
                placeholder="Structure, grading rules, permitted materials, oral sequence…"
                className={`${inputClass} mt-1 w-full`}
              />
            </label>
            <button
              type="submit"
              className="justify-self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Save exam profile
            </button>
          </form>
        ) : exam.profile ? (
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <Metadata
              label="Type"
              value={exam.profile.assessmentType || "Unknown"}
            />
            <Metadata
              label="Format"
              value={exam.profile.format || "Not specified"}
            />
            <Metadata
              label="Duration"
              value={
                exam.profile.durationMinutes
                  ? `${exam.profile.durationMinutes} minutes`
                  : "Not specified"
              }
            />
            <Metadata
              label="Grading"
              value={exam.profile.gradingScale || "Not specified"}
            />
            <Metadata
              label="Open book"
              value={
                exam.profile.openBook == null
                  ? "Unknown"
                  : exam.profile.openBook
                    ? "Yes"
                    : "No"
              }
            />
            <Metadata
              label="Calculator"
              value={
                exam.profile.calculatorAllowed == null
                  ? "Unknown"
                  : exam.profile.calculatorAllowed
                    ? "Allowed"
                    : "Not allowed"
              }
            />
            {exam.profile.details ? (
              <div className="sm:col-span-3">
                <dt className="text-zinc-500">Details</dt>
                <dd className="mt-1 whitespace-pre-wrap leading-6">
                  {exam.profile.details}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            No verified exam profile has been added yet.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Exam experiences</h2>
          <p className="mt-1 text-sm text-zinc-500">
            First-hand reports stay distinct from question occurrence evidence.
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
                placeholder="Experience title"
                aria-label="Experience title"
                className={inputClass}
              />
              <textarea
                name="body"
                required
                maxLength={20_000}
                rows={4}
                placeholder="What happened, what mattered, and what would you prepare?"
                aria-label="Exam experience"
                className={inputClass}
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  name="academicYear"
                  maxLength={20}
                  placeholder="2026/27"
                  aria-label="Academic year"
                  className={inputClass}
                />
                <input
                  name="examDate"
                  type="date"
                  aria-label="Exam date"
                  className={inputClass}
                />
                <input
                  name="grade"
                  maxLength={40}
                  placeholder="Grade (optional)"
                  aria-label="Grade"
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
                Hide my name on this experience
              </label>
              <button
                type="submit"
                className="justify-self-start rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Add experience
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
                        ? "Anonymous contributor"
                        : experience.authorName}
                      {experience.academicYear
                        ? ` · ${experience.academicYear}`
                        : ""}
                      {experience.grade ? ` · grade ${experience.grade}` : ""}
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
              No exam experiences yet.
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Confidence-aware ranking</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            With limited evidence we show report, session and contributor
            counts plus “Not enough data”. S–D tiers appear only after at least
            10 approved reports, 3 sessions and 5 unique contributors.
          </p>

          {canPost ? (
            <form
              action={createExamQuestionAction}
              className="mt-6 grid gap-2 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-950"
            >
              <CourseIdentity
                coursePageId={coursePageId}
                courseSlug={courseSlug}
              />
              <textarea
                name="prompt"
                required
                maxLength={10_000}
                rows={3}
                placeholder="Exam question or recurring prompt"
                aria-label="Question prompt"
                className={inputClass}
              />
              <textarea
                name="answerGuidance"
                maxLength={10_000}
                rows={2}
                placeholder="Answer guidance (optional)"
                aria-label="Answer guidance"
                className={inputClass}
              />
              <select
                name="difficulty"
                defaultValue=""
                aria-label="Difficulty"
                className={inputClass}
              >
                <option value="">Difficulty unknown</option>
                <option value="1">1 · Easy</option>
                <option value="2">2</option>
                <option value="3">3 · Medium</option>
                <option value="4">4</option>
                <option value="5">5 · Hard</option>
              </select>
              <button
                type="submit"
                className="justify-self-start rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900"
              >
                Add question
              </button>
            </form>
          ) : null}
        </section>
      </div>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Question bank</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Ranked by reported recurrence, not by a hidden model.
            </p>
          </div>
          <span className="text-sm text-zinc-500">
            {questions.length} questions
          </span>
        </div>

        <ol className="mt-4 space-y-4">
          {questions.map((question) => (
            <li
              key={question.id}
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
                        Added by {question.creatorName}
                        {question.difficulty
                          ? ` · difficulty ${question.difficulty}/5`
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
                      {question.evidence.occurrences} reports
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      {question.evidence.distinctSessions} sessions
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      {question.evidence.distinctContributors} contributors
                    </span>
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                      {question.evidence.netVotes >= 0 ? "+" : ""}
                      {question.evidence.netVotes} votes
                    </span>
                  </div>

                  {question.answerGuidance ? (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer font-medium text-indigo-600 dark:text-indigo-400">
                        Show answer guidance
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
                        View occurrence evidence
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
                          placeholder="Session, e.g. Winter 2026"
                          aria-label="Exam session"
                          className={inputClass}
                        />
                        <input
                          name="occurredOn"
                          type="date"
                          aria-label="Occurrence date"
                          className={inputClass}
                        />
                        <input
                          name="notes"
                          maxLength={2000}
                          placeholder="Optional occurrence notes"
                          aria-label="Occurrence notes"
                          className={inputClass}
                        />
                        <button
                          type="submit"
                          className="justify-self-start rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold dark:border-zinc-700"
                        >
                          Report occurrence
                        </button>
                      </form>

                      <div className="space-y-2">
                        <div className="flex gap-2">
                          {[
                            [1, "Useful"],
                            [-1, "Not useful"],
                          ].map(([value, label]) => (
                            <form
                              key={value}
                              action={voteExamQuestionAction}
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
                              aria-label="Merge target"
                              className={inputClass}
                            >
                              <option value="" disabled>
                                Suggest duplicate of…
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
                              placeholder="Why are these duplicates?"
                              aria-label="Merge rationale"
                              className={inputClass}
                            />
                            <button
                              type="submit"
                              className="justify-self-start rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold dark:border-zinc-700"
                            >
                              Request merge
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
            No exam questions yet.
          </p>
        ) : null}
      </section>

      {canModerate && exam.mergeRequests.length > 0 ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-semibold">Open merge requests</h2>
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
                    <strong>Source:</strong>{" "}
                    {source?.prompt || request.sourceQuestionId}
                  </p>
                  <p className="mt-1">
                    <strong>Target:</strong>{" "}
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
                      Accept and merge
                    </button>
                    <button
                      type="submit"
                      name="decision"
                      value="rejected"
                      className="rounded-lg border border-zinc-300 px-3 py-2 text-xs font-semibold dark:border-zinc-700"
                    >
                      Reject
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

function TierBadge({
  tier,
  sufficient,
}: {
  tier: "S" | "A" | "B" | "C" | "D" | null;
  sufficient: boolean;
}) {
  if (!sufficient || !tier) {
    return (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-center text-[10px] font-semibold leading-tight text-zinc-500 dark:bg-zinc-800">
        Not
        <br />
        enough
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
      aria-label={`Tier ${tier}`}
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

function HideExamContentForm({
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
  return (
    <form action={setExamContentHiddenAction}>
      <CourseIdentity
        coursePageId={coursePageId}
        courseSlug={courseSlug}
      />
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <button
        type="submit"
        name="hidden"
        value={hidden ? "no" : "yes"}
        className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs dark:border-zinc-700"
      >
        {hidden ? "Restore" : "Hide"}
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
