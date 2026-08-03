import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { asc, sql } from "drizzle-orm";

import {
  type CurriculumCatalog,
  validateCurriculumCatalog,
} from "../curriculum/schema";
import { academicTaxonomy } from "../academics/taxonomy";
import { closeDb, db } from "./client";
import {
  curriculumTemplates,
  academicFields,
  programAcademicFields,
  programs,
  subjects,
  subtopicPrerequisites,
  subtopics,
  templateSubtopicPrerequisites,
  templateSubtopics,
  templateTopics,
  topics,
} from "./schema";

/**
 * Idempotent seed: multilingual academic taxonomy, canonical programmes and
 * the curriculum JSON files in
 * curriculum/. Everything is keyed on slugs, so re-running updates names,
 * descriptions, depths, and ordering in place — it never duplicates.
 *
 * Run with: npm run db:seed
 */

const LEGACY_ENGINEERING_PROGRAMS = [
  { slug: "mechanical-engineering", name: "Mechanical Engineering" },
  { slug: "electrical-engineering", name: "Electrical Engineering" },
  { slug: "civil-engineering", name: "Civil Engineering" },
  { slug: "computer-engineering", name: "Computer Engineering" },
  { slug: "chemical-engineering", name: "Chemical Engineering" },
  { slug: "aerospace-engineering", name: "Aerospace Engineering" },
  { slug: "industrial-engineering", name: "Industrial Engineering" },
  { slug: "biomedical-engineering", name: "Biomedical Engineering" },
  { slug: "materials-engineering", name: "Materials Engineering" },
  { slug: "general-engineering", name: "General Engineering" },
];

interface CurriculumFile {
  subject: {
    slug: string;
    name: string;
    description: string;
    year: number;
    position: number;
    min_sample_size: number;
  };
  topics: {
    slug: string;
    name: string;
    description?: string;
    subtopics: {
      slug: string;
      name: string;
      description?: string;
      depth: "awareness" | "procedural" | "fluency" | "proof";
      est_hours?: number;
      prerequisites?: string[];
    }[];
  }[];
}

const CURRICULUM_FILES = [
  "calculus-1.json",
  "linear-algebra.json",
  "physics-1.json",
  "chemistry-1.json",
];

async function seedAcademicTaxonomyAndPrograms() {
  const fieldIdByKey = new Map<string, string>();
  for (const field of academicTaxonomy) {
    const id = deterministicUuid(`academic-field:${field.key}`);
    const parentId = field.parentKey
      ? fieldIdByKey.get(field.parentKey) ?? null
      : null;
    await db
      .insert(academicFields)
      .values({
        id,
        stableKey: field.key,
        parentId,
        level: field.level,
        labels: field.labels,
        aliases: field.aliases,
        typicalDegreeLevels: field.typicalDegreeLevels,
        classificationReferences: field.classificationReferences,
      })
      .onConflictDoUpdate({
        target: academicFields.stableKey,
        set: {
          parentId,
          level: field.level,
          labels: field.labels,
          aliases: field.aliases,
          typicalDegreeLevels: field.typicalDegreeLevels,
          classificationReferences: field.classificationReferences,
          active: true,
          updatedAt: new Date(),
        },
      });
    fieldIdByKey.set(field.key, id);
  }

  // Top-level domains are valid temporary onboarding choices when an
  // institution has not published a discoverable degree catalogue yet.
  const taxonomyPrograms = academicTaxonomy;
  const allPrograms = [
    ...taxonomyPrograms.map((field) => ({
      slug: field.key,
      name: field.labels.en,
      localizedNames: field.labels,
      aliases: field.aliases,
      typicalDegreeLevels: field.typicalDegreeLevels,
      academicFieldKey: field.key,
    })),
    ...LEGACY_ENGINEERING_PROGRAMS.map((program) => ({
      ...program,
      localizedNames: { en: program.name },
      aliases: { en: [], it: [] },
      typicalDegreeLevels: ["bachelor", "master"] as const,
      academicFieldKey:
        program.slug === "general-engineering" ? "engineering" : program.slug,
    })),
  ];

  for (const program of allPrograms) {
    await db
      .insert(programs)
      .values({
        slug: program.slug,
        name: program.name,
        localizedNames: program.localizedNames,
        aliases: program.aliases,
        typicalDegreeLevels: [...program.typicalDegreeLevels],
        status: "verified",
      })
      .onConflictDoUpdate({
        target: programs.slug,
        set: {
          name: program.name,
          localizedNames: program.localizedNames,
          aliases: program.aliases,
          typicalDegreeLevels: [...program.typicalDegreeLevels],
        },
      });

    const academicFieldId = fieldIdByKey.get(program.academicFieldKey);
    if (!academicFieldId) continue;
    const [programRow] = await db
      .select({ id: programs.id })
      .from(programs)
      .where(sql`${programs.slug} = ${program.slug}`)
      .limit(1);
    if (programRow) {
      await db
        .insert(programAcademicFields)
        .values({
          programId: programRow.id,
          academicFieldId,
          isPrimary: true,
        })
        .onConflictDoNothing();
    }
  }
  console.log(
    `Seeded ${academicTaxonomy.length} academic fields and ${allPrograms.length} programme choices`,
  );
}

async function seedCurriculum(file: string) {
  const data = JSON.parse(
    readFileSync(join(process.cwd(), "curriculum", file), "utf8"),
  ) as CurriculumFile;

  const [subject] = await db
    .insert(subjects)
    .values({
      slug: data.subject.slug,
      name: data.subject.name,
      description: data.subject.description,
      year: data.subject.year,
      position: data.subject.position,
      minSampleSize: data.subject.min_sample_size,
    })
    .onConflictDoUpdate({
      target: subjects.slug,
      set: {
        name: data.subject.name,
        description: data.subject.description,
        year: data.subject.year,
        position: data.subject.position,
        minSampleSize: data.subject.min_sample_size,
      },
    })
    .returning({ id: subjects.id });

  const topicRows = await db
    .insert(topics)
    .values(
      data.topics.map((topicData, topicIndex) => ({
        subjectId: subject.id,
        slug: topicData.slug,
        name: topicData.name,
        description: topicData.description,
        position: topicIndex + 1,
      })),
    )
    .onConflictDoUpdate({
      target: [topics.subjectId, topics.slug],
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        position: sql`excluded.position`,
      },
    })
    .returning({ id: topics.id, slug: topics.slug });

  const topicIds = new Map(topicRows.map((topic) => [topic.slug, topic.id]));
  const subtopicValues = data.topics.flatMap((topicData) => {
    const topicId = topicIds.get(topicData.slug);
    if (!topicId) {
      throw new Error(`failed to resolve seeded topic ${topicData.slug}`);
    }
    return topicData.subtopics.map((subtopic, subIndex) => ({
      topicId,
      slug: subtopic.slug,
      name: subtopic.name,
      description: subtopic.description,
      depthLevel: subtopic.depth,
      estHours: subtopic.est_hours?.toString(),
      position: subIndex + 1,
    }));
  });

  const subtopicRows = await db
    .insert(subtopics)
    .values(subtopicValues)
    .onConflictDoUpdate({
      target: [subtopics.topicId, subtopics.slug],
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        depthLevel: sql`excluded.depth_level`,
        estHours: sql`excluded.est_hours`,
        position: sql`excluded.position`,
      },
    })
    .returning({ id: subtopics.id, slug: subtopics.slug });

  // Subtopic slugs are canonical IDs in the source JSON and are expected to
  // be unique across each macro-subject.
  const subtopicIds = new Map(
    subtopicRows.map((subtopic) => [subtopic.slug, subtopic.id]),
  );
  const allSubtopics = await db
    .select({ id: subtopics.id, slug: subtopics.slug })
    .from(subtopics);
  for (const subtopic of allSubtopics) {
    if (!subtopicIds.has(subtopic.slug)) {
      subtopicIds.set(subtopic.slug, subtopic.id);
    }
  }

  const prereqEdges = data.topics.flatMap((topicData) =>
    topicData.subtopics.flatMap((subtopic) =>
      (subtopic.prerequisites ?? []).map((prerequisite) => ({
        from: subtopic.slug,
        to: prerequisite,
      })),
    ),
  );
  const resolvedEdges = prereqEdges.flatMap((edge) => {
    const subtopicId = subtopicIds.get(edge.from);
    const prerequisiteId = subtopicIds.get(edge.to);
    if (!subtopicId || !prerequisiteId) {
      console.warn(`  ! unresolved prerequisite: ${edge.from} -> ${edge.to}`);
      return [];
    }
    return [{ subtopicId, prerequisiteId }];
  });

  if (resolvedEdges.length > 0) {
    await db
      .insert(subtopicPrerequisites)
      .values(resolvedEdges)
      .onConflictDoNothing();
  }

  console.log(
    `Seeded ${data.subject.name}: ${data.topics.length} topics, ` +
      `${subtopicValues.length} subtopics, ${resolvedEdges.length} prerequisite edges`,
  );
}

/**
 * Snapshot the legacy canonical curriculum into immutable version-1 template
 * rows. IDs are reused across table namespaces when possible so provenance is
 * easy to audit. Conflicts are ignored intentionally: an existing template
 * version must never be rewritten by a later seed run.
 */
async function seedCurriculumTemplates() {
  const legacySubjects = await db
    .select()
    .from(subjects)
    .orderBy(asc(subjects.position));

  if (legacySubjects.length > 0) {
    await db
      .insert(curriculumTemplates)
      .values(
        legacySubjects.map((subject) => ({
          id: subject.id,
          templateKey: subject.slug,
          version: 1,
          name: subject.name,
          description: subject.description,
          year: subject.year,
          sourceSubjectId: subject.id,
        })),
      )
      .onConflictDoNothing();
  }

  const legacyTopics = await db.select().from(topics);
  if (legacyTopics.length > 0) {
    await db
      .insert(templateTopics)
      .values(
        legacyTopics.map((topic) => ({
          id: topic.id,
          templateId: topic.subjectId,
          stableKey: topic.slug,
          slug: topic.slug,
          name: topic.name,
          description: topic.description,
          position: topic.position,
          sourceTopicId: topic.id,
        })),
      )
      .onConflictDoNothing();
  }

  const legacySubtopics = await db.select().from(subtopics);
  if (legacySubtopics.length > 0) {
    await db
      .insert(templateSubtopics)
      .values(
        legacySubtopics.map((subtopic) => ({
          id: subtopic.id,
          templateTopicId: subtopic.topicId,
          stableKey: subtopic.slug,
          slug: subtopic.slug,
          name: subtopic.name,
          description: subtopic.description,
          depthLevel: subtopic.depthLevel,
          estHours: subtopic.estHours,
          position: subtopic.position,
          sourceSubtopicId: subtopic.id,
        })),
      )
      .onConflictDoNothing();
  }

  const legacyEdges = await db.select().from(subtopicPrerequisites);
  if (legacyEdges.length > 0) {
    await db
      .insert(templateSubtopicPrerequisites)
      .values(legacyEdges)
      .onConflictDoNothing();
  }

  console.log(
    `Seeded ${legacySubjects.length} immutable curriculum templates: ` +
      `${legacyTopics.length} topics, ${legacySubtopics.length} subtopics, ` +
      `${legacyEdges.length} prerequisite edges`,
  );
}

function deterministicUuid(value: string): string {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

async function seedCatalog() {
  const raw: unknown = JSON.parse(
    readFileSync(join(process.cwd(), "curriculum", "catalog.json"), "utf8"),
  );
  const validated = validateCurriculumCatalog(raw);
  if (!validated.catalog || validated.issues.length > 0) {
    throw new Error(
      `Invalid curriculum catalog: ${validated.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`,
    );
  }

  const catalog: CurriculumCatalog = validated.catalog;
  for (const template of catalog.templates) {
    const templateId = deterministicUuid(
      `curriculum-template:${template.templateKey}:v${template.version}`,
    );
    const [existingTemplate] = await db
      .select({ id: curriculumTemplates.id })
      .from(curriculumTemplates)
      .where(
        sql`${curriculumTemplates.templateKey} = ${template.templateKey}
          and ${curriculumTemplates.version} = ${template.version}`,
      )
      .limit(1);

    const resolvedTemplateId = existingTemplate?.id ?? templateId;
    if (!existingTemplate) {
      await db.insert(curriculumTemplates).values({
        id: templateId,
        templateKey: template.templateKey,
        version: template.version,
        name: template.name,
        localizedNames: template.localizedNames,
        description: template.description,
        category: template.category,
        academicDomainKey: template.academicDomainKey,
        disciplineTags: template.disciplineTags,
        recommendedDegreePrograms: template.recommendedDegreePrograms,
        typicalYear: template.typicalYear,
        typicalSemester: template.typicalSemester,
        typicalDegreeLevels: template.typicalDegreeLevels,
        typicalStage: template.typicalStage,
        curricularStatus: template.curricularStatus,
        validationMetadata: template.validationMetadata,
        year: template.typicalYear,
        sourceReferences: template.sourceReferences,
      });
    }

    const topicRows = template.topics.map((topic) => ({
      id: deterministicUuid(topic.stableId),
      templateId: resolvedTemplateId,
      stableKey: topic.stableId,
      slug: topic.slug,
      name: topic.name,
      description: topic.description,
      position: topic.position,
    }));
    if (topicRows.length > 0) {
      await db.insert(templateTopics).values(topicRows).onConflictDoNothing();
    }

    const subtopicRows = template.topics.flatMap((topic) =>
      topic.subtopics.map((subtopic) => ({
        id: deterministicUuid(subtopic.stableId),
        templateTopicId: deterministicUuid(topic.stableId),
        stableKey: subtopic.stableId,
        slug: subtopic.slug,
        name: subtopic.name,
        description: subtopic.description,
        depthLevel: subtopic.depthLevel,
        estHours: subtopic.estimatedHours.toString(),
        optional: subtopic.optional,
        position: subtopic.position,
      })),
    );
    if (subtopicRows.length > 0) {
      await db
        .insert(templateSubtopics)
        .values(subtopicRows)
        .onConflictDoNothing();
    }

    const prerequisiteRows = template.topics.flatMap((topic) =>
      topic.subtopics.flatMap((subtopic) =>
        subtopic.prerequisiteStableIds.map((prerequisiteStableId) => ({
          subtopicId: deterministicUuid(subtopic.stableId),
          prerequisiteId: deterministicUuid(prerequisiteStableId),
        })),
      ),
    );
    if (prerequisiteRows.length > 0) {
      await db
        .insert(templateSubtopicPrerequisites)
        .values(prerequisiteRows)
        .onConflictDoNothing();
    }
  }

  const totals = catalog.templates.reduce(
    (result, template) => {
      result.topics += template.topics.length;
      result.subtopics += template.topics.reduce(
        (count, topic) => count + topic.subtopics.length,
        0,
      );
      return result;
    },
    { topics: 0, subtopics: 0 },
  );
  console.log(
    `Seeded ${catalog.templates.length} immutable catalog templates: ` +
      `${totals.topics} topics, ${totals.subtopics} subtopics`,
  );
}

async function main() {
  await seedAcademicTaxonomyAndPrograms();
  for (const file of CURRICULUM_FILES) {
    await seedCurriculum(file);
  }
  await seedCatalog();
}

async function run() {
  try {
    await main();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    try {
      await closeDb();
    } catch (err) {
      console.error("Failed to close the database connection", err);
      process.exitCode = 1;
    }
  }
}

void run();
