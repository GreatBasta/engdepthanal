import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { asc, countDistinct, eq } from "drizzle-orm";

import { currentStudentId } from "@/auth";
import { db } from "@/lib/db/client";
import {
  curriculumTemplates,
  programs,
  templateSubtopics,
  templateTopics,
} from "@/lib/db/schema";
import {
  getPrimaryEnrollmentForStudent,
  organizationResultFromPrimaryEnrollment,
} from "@/lib/enrollment";
import { getI18n } from "@/lib/i18n/server";
import { getCatalogCandidateForImport } from "@/lib/catalog/review";
import { getLocalOrganizationByIdentifier } from "@/lib/organizations/search";
import { searchAcademicTaxonomy } from "@/lib/academics/taxonomy";

import { CreateCourseForm } from "./ui";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("create.title") };
}

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ candidate?: string }>;
}) {
  const [studentId, i18n, query] = await Promise.all([
    currentStudentId(),
    getI18n(),
    searchParams,
  ]);
  const { t } = i18n;
  if (!studentId) redirect("/login?next=/courses/new");

  const [templateRows, degreeProgramRows, enrollment] = await Promise.all([
    db
      .select({
        id: curriculumTemplates.id,
        name: curriculumTemplates.name,
        description: curriculumTemplates.description,
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
      .orderBy(asc(curriculumTemplates.year), asc(curriculumTemplates.name)),
    db
      .select({
        slug: programs.slug,
        name: programs.name,
      })
      .from(programs)
      .where(eq(programs.status, "verified"))
      .orderBy(asc(programs.name)),
    getPrimaryEnrollmentForStudent(studentId),
  ]);

  if (!enrollment) redirect("/onboarding");
  const defaultOrganization =
    organizationResultFromPrimaryEnrollment(enrollment);
  const candidateId = /^[0-9a-f-]{36}$/i.test(query.candidate ?? "")
    ? query.candidate!
    : null;
  const importCandidate = candidateId
    ? await getCatalogCandidateForImport(candidateId)
    : null;
  const importOrganization = importCandidate
    ? await getLocalOrganizationByIdentifier(importCandidate.organizationId)
    : null;
  const suggestedProgramSlug = importCandidate?.degreeProgramme
    ? searchAcademicTaxonomy(importCandidate.degreeProgramme, i18n.locale).find(
        (field) => degreeProgramRows.some((program) => program.slug === field.key),
      )?.key
    : null;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← {t("create.backHome")}
        </Link>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
          {t("create.kicker")}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {t("create.title")}
        </h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          {t("create.subtitle")}
        </p>
      </header>

      <CreateCourseForm
        templates={templateRows}
        degreePrograms={degreeProgramRows}
        defaultOrganization={defaultOrganization}
        defaultUniversityProgramId={enrollment.universityProgramId}
        defaultCohortYear={enrollment.intakeYear}
        defaultAcademicYear={`${new Date().getFullYear()}/${String(
          new Date().getFullYear() + 1,
        ).slice(-2)}`}
        defaultAttendance={
          enrollment.phase === "attending" ? "attended" : "not_attended"
        }
        defaultProgramSlug={enrollment.programSlug}
        importCandidate={
          importCandidate && importOrganization
            ? {
                ...importCandidate,
                organization: importOrganization,
                programSlug: suggestedProgramSlug ?? enrollment.programSlug,
              }
            : null
        }
      />
    </main>
  );
}
