import { z } from "zod";

import { academicTaxonomy, degreeLevels } from "../academics/taxonomy";
import { curriculumCategoryKeys } from "./taxonomy";

export const curriculumDepthLevels = [
  "awareness",
  "procedural",
  "fluency",
  "proof",
] as const;

export const sourceReferenceSchema = z.object({
  title: z.string().trim().min(1),
  organization: z.string().trim().min(1),
  url: z.string().url(),
  accessedAt: z.string().date(),
  note: z.string().trim().min(1).optional(),
});

export const curriculumSubtopicSchema = z.object({
  stableId: z.string().trim().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  depthLevel: z.enum(curriculumDepthLevels),
  estimatedHours: z.number().finite().nonnegative(),
  prerequisiteStableIds: z.array(z.string().trim().min(1)).default([]),
  optional: z.boolean().default(false),
  position: z.number().int().positive(),
});

export const curriculumTopicSchema = z.object({
  stableId: z.string().trim().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  position: z.number().int().positive(),
  subtopics: z.array(curriculumSubtopicSchema).min(1),
});

export const curriculumTemplateSchema = z.object({
  templateKey: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  localizedNames: z
    .record(z.string().trim().min(1))
    .refine((names) => Boolean(names.en), "must include an English name"),
  description: z.string().trim().min(1),
  category: z.enum(curriculumCategoryKeys),
  academicDomainKey: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  disciplineTags: z.array(z.string().trim().min(1)).min(1),
  recommendedDegreePrograms: z.array(z.string().trim().min(1)).min(1),
  typicalYear: z.number().int().min(1).max(6),
  typicalSemester: z.number().int().min(1).max(12),
  typicalDegreeLevels: z.array(z.enum(degreeLevels)).min(1),
  typicalStage: z.string().trim().min(1),
  curricularStatus: z.enum(["core", "optional", "mixed"]).default("core"),
  version: z.number().int().positive(),
  sourceReferences: z.array(sourceReferenceSchema).min(1),
  validationMetadata: z
    .object({
      reviewedAt: z.string().date(),
      reviewedBy: z.string().trim().min(1),
      contentStandard: z.string().trim().min(1),
      notes: z.array(z.string().trim().min(1)).default([]),
    })
    .strict(),
  topics: z.array(curriculumTopicSchema).min(1),
});

export const curriculumCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  templates: z.array(curriculumTemplateSchema).min(24),
});

export type CurriculumTemplate = z.infer<typeof curriculumTemplateSchema>;
export type CurriculumCatalog = z.infer<typeof curriculumCatalogSchema>;

export interface CurriculumValidationIssue {
  path: string;
  message: string;
}

export function validateCurriculumCatalog(input: unknown): {
  catalog?: CurriculumCatalog;
  issues: CurriculumValidationIssue[];
} {
  const parsed = curriculumCatalogSchema.safeParse(input);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const catalog = parsed.data;
  const issues: CurriculumValidationIssue[] = [];
  const templateKeys = new Set<string>();
  const globalStableIds = new Set<string>();
  const domainKeys = new Set(
    academicTaxonomy
      .filter((field) => field.level === "domain")
      .map((field) => field.key),
  );

  for (const template of catalog.templates) {
    if (templateKeys.has(template.templateKey)) {
      issues.push({
        path: template.templateKey,
        message: "duplicate templateKey",
      });
    }
    templateKeys.add(template.templateKey);
    if (!domainKeys.has(template.academicDomainKey)) {
      issues.push({
        path: `${template.templateKey}.academicDomainKey`,
        message: "must reference a top-level academic domain",
      });
    }
    if (!template.disciplineTags.includes(template.category)) {
      issues.push({
        path: `${template.templateKey}.disciplineTags`,
        message: `must include its macro category ${template.category}`,
      });
    }

    const topicSlugs = new Set<string>();
    const templateStableIds = new Set<string>();
    const allSubtopics = template.topics.flatMap((topic) => topic.subtopics);
    if (
      allSubtopics.some((subtopic) => subtopic.estimatedHours === 0) &&
      !template.validationMetadata.notes.some((note) =>
        note.toLocaleLowerCase("en").includes("workload"),
      )
    ) {
      issues.push({
        path: `${template.templateKey}.validationMetadata.notes`,
        message: "zero workload estimates must be explicitly documented",
      });
    }

    for (const topic of template.topics) {
      if (topicSlugs.has(topic.slug)) {
        issues.push({
          path: `${template.templateKey}.topics.${topic.slug}`,
          message: "duplicate topic slug",
        });
      }
      topicSlugs.add(topic.slug);
      if (globalStableIds.has(topic.stableId)) {
        issues.push({ path: topic.stableId, message: "duplicate stableId" });
      }
      globalStableIds.add(topic.stableId);
      templateStableIds.add(topic.stableId);

      const subtopicSlugs = new Set<string>();
      const subtopicNames = new Set<string>();
      topic.subtopics.forEach((subtopic, index) => {
        if (subtopic.position !== index + 1) {
          issues.push({
            path: subtopic.stableId,
            message: "subtopic positions must be contiguous and ordered",
          });
        }
        const normalizedName = subtopic.name.toLocaleLowerCase("en");
        if (
          subtopicSlugs.has(subtopic.slug) ||
          subtopicNames.has(normalizedName)
        ) {
          issues.push({
            path: subtopic.stableId,
            message: "duplicate subtopic in topic scope",
          });
        }
        subtopicSlugs.add(subtopic.slug);
        subtopicNames.add(normalizedName);
        if (globalStableIds.has(subtopic.stableId)) {
          issues.push({
            path: subtopic.stableId,
            message: "duplicate stableId",
          });
        }
        globalStableIds.add(subtopic.stableId);
        templateStableIds.add(subtopic.stableId);
      });
    }

    template.topics.forEach((topic, index) => {
      if (topic.position !== index + 1) {
        issues.push({
          path: topic.stableId,
          message: "topic positions must be contiguous and ordered",
        });
      }
    });

    const subtopicById = new Map(
      allSubtopics.map((subtopic) => [subtopic.stableId, subtopic]),
    );
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id)) {
        issues.push({ path: id, message: "prerequisite cycle detected" });
        return;
      }
      if (visited.has(id)) return;
      visiting.add(id);
      const subtopic = subtopicById.get(id);
      for (const prerequisiteId of subtopic?.prerequisiteStableIds ?? []) {
        if (!templateStableIds.has(prerequisiteId)) {
          issues.push({
            path: id,
            message: `missing prerequisite ${prerequisiteId}`,
          });
        } else if (subtopicById.has(prerequisiteId)) {
          visit(prerequisiteId);
        }
      }
      visiting.delete(id);
      visited.add(id);
    };
    allSubtopics.forEach((subtopic) => visit(subtopic.stableId));
  }

  return { catalog, issues };
}
