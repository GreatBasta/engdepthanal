import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateCurriculumCatalog } from "../src/lib/curriculum/schema";

test("the production catalog satisfies the shared curriculum schema", () => {
  const catalog: unknown = JSON.parse(
    readFileSync(resolve("curriculum/catalog.json"), "utf8"),
  );
  const result = validateCurriculumCatalog(catalog);
  assert.deepEqual(result.issues, []);
  assert.ok((result.catalog?.templates.length ?? 0) >= 70);
  assert.ok(
    new Set(result.catalog?.templates.map((template) => template.category)).size >=
      12,
  );
  assert.ok(
    (result.catalog?.templates.filter((template) => template.localizedNames.it)
      .length ?? 0) >= 25,
  );
  assert.ok(
    result.catalog?.templates.every(
      (template) =>
        template.sourceReferences.length > 0 &&
        template.academicDomainKey &&
        template.typicalDegreeLevels.length > 0 &&
        template.typicalStage &&
        template.validationMetadata.reviewedAt,
    ),
  );
});

test("rejects missing prerequisites and prerequisite cycles", () => {
  const template = {
    schemaVersion: 1,
    generatedAt: "2026-07-30T00:00:00.000Z",
    templates: Array.from({ length: 24 }, (_, index) => ({
      templateKey: `template-${index}`,
      name: `Template ${index}`,
      localizedNames: { en: `Template ${index}` },
      description: "Validation fixture",
      category: "mathematics",
      academicDomainKey: "mathematics-statistics",
      disciplineTags: ["all-engineering"],
      recommendedDegreePrograms: ["all-engineering"],
      typicalYear: 1,
      typicalSemester: 1,
      typicalDegreeLevels: ["bachelor"],
      typicalStage: "foundation",
      curricularStatus: "core",
      version: 1,
      sourceReferences: [
        {
          title: "Source",
          organization: "University",
          url: "https://example.edu/syllabus",
          accessedAt: "2026-07-30",
        },
      ],
      validationMetadata: {
        reviewedAt: "2026-08-03",
        reviewedBy: "Test",
        contentStandard: "Test fixture",
        notes: [],
      },
      topics: [
        {
          stableId: `template-${index}.topic.one`,
          slug: "one",
          name: "One",
          description: "Topic",
          position: 1,
          subtopics: [
            {
              stableId: `template-${index}.subtopic.a`,
              slug: "a",
              name: "A",
              description: "A",
              depthLevel: "procedural",
              estimatedHours: 1,
              prerequisiteStableIds: [`template-${index}.subtopic.b`],
              optional: false,
              position: 1,
            },
            {
              stableId: `template-${index}.subtopic.b`,
              slug: "b",
              name: "B",
              description: "B",
              depthLevel: "procedural",
              estimatedHours: 1,
              prerequisiteStableIds: [`template-${index}.subtopic.a`],
              optional: false,
              position: 2,
            },
          ],
        },
      ],
    })),
  };
  const result = validateCurriculumCatalog(template);
  assert.ok(result.issues.some((issue) => /cycle/.test(issue.message)));
});

test("rejects templates placed outside their declared macro category", () => {
  const source: unknown = JSON.parse(
    readFileSync(resolve("curriculum/catalog.json"), "utf8"),
  );
  const valid = validateCurriculumCatalog(source);
  assert.ok(valid.catalog);
  const catalog = structuredClone(valid.catalog);
  const firstTemplate = catalog.templates[0];
  assert.ok(firstTemplate);
  firstTemplate.disciplineTags = firstTemplate.disciplineTags.filter(
    (tag) => tag !== firstTemplate.category,
  );
  const result = validateCurriculumCatalog(catalog);
  assert.ok(
    result.issues.some((issue) => /macro category/.test(issue.message)),
  );
});
