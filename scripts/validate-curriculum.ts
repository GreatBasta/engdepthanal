import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

import { validateCurriculumCatalog } from "../src/lib/curriculum/schema";

const file = resolve(process.cwd(), "curriculum", "catalog.json");
const source = readFileSync(file, "utf8");
const input: unknown = JSON.parse(source);
const { catalog, issues } = validateCurriculumCatalog(input);

if (!catalog || issues.length > 0) {
  for (const issue of issues) {
    console.error(`${issue.path || "catalog"}: ${issue.message}`);
  }
  process.exitCode = 1;
} else {
  const topics = catalog.templates.reduce(
    (total, template) => total + template.topics.length,
    0,
  );
  const subtopics = catalog.templates.reduce(
    (total, template) =>
      total +
      template.topics.reduce(
        (templateTotal, topic) => templateTotal + topic.subtopics.length,
        0,
      ),
    0,
  );
  const deterministicPayload = JSON.stringify({
    schemaVersion: catalog.schemaVersion,
    templates: catalog.templates,
  });
  console.log({
    templates: catalog.templates.length,
    topics,
    subtopics,
    checksum: createHash("sha256")
      .update(deterministicPayload)
      .digest("hex")
      .slice(0, 16),
  });
}
