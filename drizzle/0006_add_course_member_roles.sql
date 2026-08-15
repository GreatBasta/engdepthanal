-- PostgreSQL requires enum values added with ALTER TYPE to be committed before
-- they can be referenced by defaults or data updates. Keep this migration
-- intentionally limited to enum expansion.
ALTER TYPE "public"."course_member_role" ADD VALUE IF NOT EXISTS 'coowner';--> statement-breakpoint
ALTER TYPE "public"."course_member_role" ADD VALUE IF NOT EXISTS 'visitor';
