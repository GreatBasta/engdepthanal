import { notFound } from "next/navigation";

import { currentStudentId } from "@/auth";
import { getCourseBySlugForViewer } from "@/lib/courses/data";

import { CurriculumPanel } from "../../curriculum-panel";

export default async function CurriculumSettings({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [{ slug }, studentId] = await Promise.all([params, currentStudentId()]);
  const detail = await getCourseBySlugForViewer(slug, studentId);
  if (!detail?.permissions.canEdit) notFound();
  return (
    <CurriculumPanel
      coursePageId={detail.course.id}
      courseSlug={slug}
      canEdit
    />
  );
}
