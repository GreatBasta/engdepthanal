import {
  getCourseCurriculumOutline,
  type CurriculumView,
} from "@/lib/courses/curriculum";
import type { CurriculumTopicSummary } from "@/lib/courses/curriculum-contract";
import { getI18n } from "@/lib/i18n/server";

import { CurriculumAccordion } from "./curriculum-accordion";

export async function CurriculumPanel({
  coursePageId,
  courseSlug,
  canEdit,
  canTrack = false,
  lastAppliedAt,
  selectedTopic,
  settingsMode = false,
}: {
  coursePageId: string;
  courseSlug: string;
  canEdit: boolean;
  canTrack?: boolean;
  lastAppliedAt?: Date;
  preview?: string;
  selectedTopic?: string;
  settingsMode?: boolean;
  viewerStudentId?: string | null;
}) {
  const view: CurriculumView = canEdit ? "draft" : "published";
  const [curriculum, i18n] = await Promise.all([
    getCourseCurriculumOutline(coursePageId, view),
    getI18n(),
  ]);
  const { t } = i18n;

  if (!curriculum) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-10 text-center">
        <h2 className="text-xl font-semibold">{t("curriculum.unavailable")}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-600">
          {canEdit ? t("curriculum.applyFailed") : t("common.notFound")}
        </p>
      </section>
    );
  }

  const topics: CurriculumTopicSummary[] = curriculum.topics
    .filter((topic) => canEdit || topic.hiddenAt === null)
    .map((topic) => ({
      id: topic.id,
      stableId: topic.stableId,
      name: topic.name,
      description: topic.description,
      position: topic.position,
      provenance: topic.provenance,
      hidden: topic.hiddenAt !== null,
      subtopicCount: Number(topic.subtopicCount),
      classifiedCount: Number(topic.classifiedCount),
      coveredCount: Number(topic.coveredCount),
      notCoveredCount: Number(topic.notCoveredCount),
    }));

  return (
    <CurriculumAccordion
      coursePageId={coursePageId}
      courseSlug={courseSlug}
      canEdit={canEdit}
      canTrack={canTrack}
      initialTopicStableId={selectedTopic}
      initialAdvancedChangesPending={
        curriculum.version.updatedAt.getTime() >
        curriculum.version.createdAt.getTime()
      }
      lastUpdatedAt={(
        lastAppliedAt ?? curriculum.version.updatedAt
      ).toISOString()}
      settingsMode={settingsMode}
      topics={topics}
    />
  );
}
