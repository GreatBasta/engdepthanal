import { count, sql } from "drizzle-orm";
import type { AnyPgTable } from "drizzle-orm/pg-core";

import { closeDb, db } from "./client";
import {
  curriculumTemplates,
  subjects,
  subtopicPrerequisites,
  subtopics,
  templateSubtopicPrerequisites,
  templateSubtopics,
  templateTopics,
  topics,
} from "./schema";

async function tableCount(table: AnyPgTable): Promise<number> {
  const [row] = await db.select({ value: count() }).from(table);
  return Number(row.value);
}

async function verify() {
  const [
    migrationResult,
    subjectCount,
    templateCount,
    topicCount,
    templateTopicCount,
    subtopicCount,
    templateSubtopicCount,
    edgeCount,
    templateEdgeCount,
  ] = await Promise.all([
    db.execute(
      sql`select count(*)::integer as count from drizzle.__drizzle_migrations`,
    ),
    tableCount(subjects),
    tableCount(curriculumTemplates),
    tableCount(topics),
    tableCount(templateTopics),
    tableCount(subtopics),
    tableCount(templateSubtopics),
    tableCount(subtopicPrerequisites),
    tableCount(templateSubtopicPrerequisites),
  ]);

  const checks = [
    ["templates", subjectCount, templateCount],
    ["template topics", topicCount, templateTopicCount],
    ["template subtopics", subtopicCount, templateSubtopicCount],
    ["template prerequisite edges", edgeCount, templateEdgeCount],
  ] as const;

  for (const [label, legacy, snapshot] of checks) {
    if (legacy !== snapshot) {
      throw new Error(`${label}: expected ${legacy}, found ${snapshot}`);
    }
  }

  console.log({
    migrations: Number(migrationResult[0]?.count ?? 0),
    templates: templateCount,
    topics: templateTopicCount,
    subtopics: templateSubtopicCount,
    prerequisiteEdges: templateEdgeCount,
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
