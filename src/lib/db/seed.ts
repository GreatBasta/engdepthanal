import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";

import { db } from "./client";
import {
  programs,
  subjects,
  subtopicPrerequisites,
  subtopics,
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

  // Subtopic slug -> id across the whole subject, for prerequisite wiring.
  const subtopicIds = new Map<string, string>();
  // Deferred: prerequisites may point at subtopics in later topics.
  const prereqEdges: { from: string; to: string }[] = [];
  let subtopicCount = 0;

  for (const [topicIndex, topicData] of data.topics.entries()) {
    const [topic] = await db
      .insert(topics)
      .values({
        subjectId: subject.id,
        slug: topicData.slug,
        name: topicData.name,
        description: topicData.description,
        position: topicIndex + 1,
      })
      .onConflictDoUpdate({
        target: [topics.subjectId, topics.slug],
        set: {
          name: topicData.name,
          description: topicData.description,
          position: topicIndex + 1,
        },
      })
      .returning({ id: topics.id });

    for (const [subIndex, sub] of topicData.subtopics.entries()) {
      const [row] = await db
        .insert(subtopics)
        .values({
          topicId: topic.id,
          slug: sub.slug,
          name: sub.name,
          description: sub.description,
          depthLevel: sub.depth,
          estHours: sub.est_hours?.toString(),
          position: subIndex + 1,
        })
        .onConflictDoUpdate({
          target: [subtopics.topicId, subtopics.slug],
          set: {
            name: sub.name,
            description: sub.description,
            depthLevel: sub.depth,
            estHours: sub.est_hours?.toString(),
            position: subIndex + 1,
          },
        })
        .returning({ id: subtopics.id });

      subtopicIds.set(sub.slug, row.id);
      subtopicCount++;
      for (const prereq of sub.prerequisites ?? []) {
        prereqEdges.push({ from: sub.slug, to: prereq });
      }
    }
  }

  let edgeCount = 0;
  for (const edge of prereqEdges) {
    const subtopicId = subtopicIds.get(edge.from);
    let prerequisiteId = subtopicIds.get(edge.to);
    if (!prerequisiteId) {
      // Cross-subject prerequisite: resolve against already-seeded subjects.
      const [found] = await db
        .select({ id: subtopics.id })
        .from(subtopics)
        .where(eq(subtopics.slug, edge.to))
        .limit(1);
      prerequisiteId = found?.id;
    }
    if (!subtopicId || !prerequisiteId) {
      console.warn(`  ! unresolved prerequisite: ${edge.from} -> ${edge.to}`);
      continue;
    }
    await db
      .insert(subtopicPrerequisites)
      .values({ subtopicId, prerequisiteId })
      .onConflictDoNothing();
    edgeCount++;
  }

  console.log(
    `Seeded ${data.subject.name}: ${data.topics.length} topics, ` +
      `${subtopicCount} subtopics, ${edgeCount} prerequisite edges`,
  );
}

async function main() {
  await seedPrograms();
  for (const file of CURRICULUM_FILES) {
    await seedCurriculum(file);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
