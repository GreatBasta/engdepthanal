import { count, sql } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";

import catalogJson from "../../../curriculum/catalog.json";
import { validateCurriculumCatalog } from "../curriculum/schema";
import { closeDb, db } from "./client";
import {
  courseResources,
  courseSubtopicProgress,
  curriculumTemplates,
  students,
  templateSubtopicPrerequisites,
  templateSubtopics,
  templateTopics,
} from "./schema";

async function tableCount(table: AnyPgTable): Promise<number> {
  const [row] = await db.select({ value: count() }).from(table);
  return Number(row.value);
}

async function scalar(query: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute(query);
  return Number(result[0]?.value ?? 0);
}

async function verify() {
  const validation = validateCurriculumCatalog(catalogJson);
  if (!validation.catalog || validation.issues.length) {
    throw new Error(
      validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("\n") || "Canonical curriculum catalog is invalid",
    );
  }
  const catalog = validation.catalog;
  const expectedTopics = catalog.templates.reduce(
    (total, template) => total + template.topics.length,
    0,
  );
  const expectedSubtopics = catalog.templates.reduce(
    (total, template) =>
      total +
      template.topics.reduce(
        (topicTotal, topic) => topicTotal + topic.subtopics.length,
        0,
      ),
    0,
  );

  const [
    migrationResult,
    templateCount,
    templateTopicCount,
    templateSubtopicCount,
    templateEdgeCount,
    studentCount,
    progressCount,
    resourceCount,
    duplicateTemplateKeys,
    duplicateStableIds,
    orphanProgress,
    orphanResources,
  ] = await Promise.all([
    db.execute(
      sql`select count(*)::integer as count from drizzle.__drizzle_migrations`,
    ),
    tableCount(curriculumTemplates),
    tableCount(templateTopics),
    tableCount(templateSubtopics),
    tableCount(templateSubtopicPrerequisites),
    tableCount(students),
    tableCount(courseSubtopicProgress),
    tableCount(courseResources),
    scalar(sql`
      select count(*) as value from (
        select template_key from curriculum_templates
        group by template_key having count(*) > 1
      ) duplicates
    `),
    scalar(sql`
      select count(*) as value from (
        select stable_id from (
          select stable_id from template_topics
          union all
          select stable_id from template_subtopics
        ) ids group by stable_id having count(*) > 1
      ) duplicates
    `),
    scalar(sql`
      select count(*) as value
      from course_subtopic_progress p
      left join course_pages c on c.id = p.course_page_id
      left join students s on s.id = p.student_id
      where c.id is null or s.id is null
    `),
    scalar(sql`
      select count(*) as value
      from course_resources r
      left join course_pages c on c.id = r.course_page_id
      left join students s on s.id = r.author_id
      where c.id is null or s.id is null
    `),
  ]);

  const failures = [
    templateCount < catalog.templates.length &&
      `canonical templates: expected at least ${catalog.templates.length}, found ${templateCount}`,
    templateTopicCount < expectedTopics &&
      `template topics: expected at least ${expectedTopics}, found ${templateTopicCount}`,
    templateSubtopicCount < expectedSubtopics &&
      `template subtopics: expected at least ${expectedSubtopics}, found ${templateSubtopicCount}`,
    duplicateTemplateKeys > 0 &&
      `duplicate template keys: ${duplicateTemplateKeys}`,
    duplicateStableIds > 0 && `duplicate stable IDs: ${duplicateStableIds}`,
    orphanProgress > 0 && `orphan progress rows: ${orphanProgress}`,
    orphanResources > 0 && `orphan resource rows: ${orphanResources}`,
  ].filter(Boolean);

  if (failures.length) throw new Error(failures.join("\n"));

  console.log({
    migrations: Number(migrationResult[0]?.count ?? 0),
    canonicalCatalog: {
      templates: catalog.templates.length,
      topics: expectedTopics,
      subtopics: expectedSubtopics,
    },
    database: {
      templates: templateCount,
      topics: templateTopicCount,
      subtopics: templateSubtopicCount,
      prerequisiteEdges: templateEdgeCount,
      students: studentCount,
      progress: progressCount,
      resources: resourceCount,
    },
    integrity: "ok",
  });
}

async function run() {
  try {
    await verify();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

void run();
