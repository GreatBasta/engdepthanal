import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, countDistinct, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  curriculumTemplates,
  enrollments,
  programs,
  universities,
  universityPrograms,
  templateSubtopics,
  templateTopics,
} from "@/lib/db/schema";

import { CreateCourseForm } from "./ui";

export default async function NewCoursePage() {
  const studentId = await currentStudentId();
  if (!studentId) redirect("/login?next=/courses/new");

  const [templateRows, universityProgramRows, [enrollment]] =
    await Promise.all([
      db
        .select({
          id: curriculumTemplates.id,
          name: curriculumTemplates.name,
          description: curriculumTemplates.description,
          version: curriculumTemplates.version,
          year: curriculumTemplates.year,
          category: curriculumTemplates.category,
          disciplineTags: curriculumTemplates.disciplineTags,
          recommendedDegreePrograms:
            curriculumTemplates.recommendedDegreePrograms,
          topicCount: countDistinct(templateTopics.id),
          subtopicCount: countDistinct(templateSubtopics.id),
        })
        .from(curriculumTemplates)
        .leftJoin(
          templateTopics,
          eq(templateTopics.templateId, curriculumTemplates.id),
        )
        .leftJoin(
          templateSubtopics,
          eq(templateSubtopics.templateTopicId, templateTopics.id),
        )
        .where(eq(curriculumTemplates.isActive, true))
        .groupBy(curriculumTemplates.id)
        .orderBy(
          asc(curriculumTemplates.year),
          asc(curriculumTemplates.name),
        ),
      db
        .select({
          id: universityPrograms.id,
          universityName: universities.name,
          countryCode: universities.countryCode,
          programName: programs.name,
          localName: universityPrograms.localName,
        })
        .from(universityPrograms)
        .innerJoin(
          universities,
          eq(universityPrograms.universityId, universities.id),
        )
        .innerJoin(programs, eq(universityPrograms.programId, programs.id))
        .orderBy(asc(universities.name), asc(programs.name)),
      db
        .select({
          universityProgramId: enrollments.universityProgramId,
          intakeYear: enrollments.intakeYear,
          phase: enrollments.phase,
          programSlug: programs.slug,
        })
        .from(enrollments)
        .innerJoin(
          universityPrograms,
          eq(enrollments.universityProgramId, universityPrograms.id),
        )
        .innerJoin(programs, eq(universityPrograms.programId, programs.id))
        .where(eq(enrollments.studentId, studentId))
        .limit(1),
    ]);

  if (!enrollment) redirect("/onboarding");

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Back to dashboard
        </Link>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
          New shared course
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Turn the canonical curriculum into your course
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          Choose one or more immutable templates. We will clone them into an
          editable draft, preserving where every topic came from.
        </p>
      </header>

      <CreateCourseForm
        templates={templateRows}
        universityPrograms={universityProgramRows}
        defaultUniversityProgramId={enrollment.universityProgramId}
        defaultCohortYear={enrollment.intakeYear}
        defaultAcademicYear={`${new Date().getFullYear()}/${String(
          new Date().getFullYear() + 1,
        ).slice(-2)}`}
        defaultAttendance={
          enrollment.phase === "attending" ? "attended" : "not_attended"
        }
        defaultProgramSlug={enrollment.programSlug}
      />
    </main>
  );
}
