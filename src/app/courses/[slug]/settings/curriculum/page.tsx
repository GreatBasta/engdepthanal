import { notFound } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";

import { CurriculumPanel } from "../../curriculum-panel";

export default async function CurriculumSettings({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string }>;
}) {
  const [{ slug }, query, studentId] = await Promise.all([
    params,
    searchParams,
    currentStudentId(),
  ]);
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail?.permissions.canEdit) notFound();
  return (
    <CurriculumPanel
      coursePageId={detail.course.id}
      courseSlug={slug}
      canEdit
      selectedTopic={query.topic}
      settingsMode
      viewerStudentId={studentId}
    />
  );
}
