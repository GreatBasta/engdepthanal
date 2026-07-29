import { readFileSync } from "node:fs";
import { join } from "node:path";
import { asc, sql } from "drizzle-orm";

import { closeDb, db } from "./client";
import {
  curriculumTemplates,
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
 * Idempotent seed: canonical programs + the curriculum JSON files in
 * curriculum/. Everything is keyed on slugs, so re-running updates names,
 * descriptions, depths, and ordering in place — it never duplicates.
 *
 * Run with: npm run db:seed
 */

const ENGINEERING_PROGRAMS = [
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

async function seedPrograms() {
  for (const program of ENGINEERING_PROGRAMS) {
    await db
      .insert(programs)
      .values({ ...program, status: "verified" })
      .onConflictDoUpdate({
        target: programs.slug,
        set: { name: program.name },
      });
  }
  console.log(`Seeded ${ENGINEERING_PROGRAMS.length} programs`);
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

async function main() {
  await seedPrograms();
  for (const file of CURRICULUM_FILES) {
    await seedCurriculum(file);
  }
  await seedCurriculumTemplates();
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
