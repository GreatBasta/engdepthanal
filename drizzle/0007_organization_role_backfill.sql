-- Data-only follow-up to 0006. Keeping this in a separate migration allows
-- PostgreSQL to commit the new enum values before they are used in UPDATEs.
UPDATE "universities"
SET
  "canonical_name" = COALESCE("canonical_name", "name"),
  "display_name" = COALESCE("display_name", "name"),
  "normalized_name" = COALESCE(
    "normalized_name",
    lower(trim(regexp_replace("name", '\\s+', ' ', 'g')))
  ),
  "organization_type" = COALESCE("organization_type", 'education'),
  "updated_at" = now();
--> statement-breakpoint
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "student_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS position
  FROM "enrollments"
)
UPDATE "enrollments" AS enrollment
SET "is_primary" = true, "updated_at" = now()
FROM ranked
WHERE enrollment."id" = ranked."id" AND ranked.position = 1;
--> statement-breakpoint
UPDATE "course_members" SET "role" = 'coowner' WHERE "role" = 'editor';
--> statement-breakpoint
UPDATE "course_members" SET "role" = 'visitor' WHERE "role" IN ('contributor', 'viewer');
--> statement-breakpoint
UPDATE "course_invites" SET "role" = 'coowner' WHERE "role" = 'editor';
--> statement-breakpoint
UPDATE "course_invites" SET "role" = 'visitor' WHERE "role" IN ('contributor', 'viewer');
