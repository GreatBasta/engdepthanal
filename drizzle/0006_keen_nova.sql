CREATE TYPE "public"."coownership_request_status" AS ENUM('pending', 'accepted', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."organization_request_status" AS ENUM('pending', 'matched', 'approved', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."course_member_role" ADD VALUE 'coowner';--> statement-breakpoint
ALTER TYPE "public"."course_member_role" ADD VALUE 'visitor';--> statement-breakpoint
CREATE TABLE "course_coownership_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"message" text,
	"status" "coownership_request_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"requested_name" text NOT NULL,
	"country_code" char(2),
	"city" text,
	"website_url" text,
	"local_organization_id" uuid,
	"candidate_ror_id" text,
	"status" "organization_request_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "course_invites" ALTER COLUMN "role" SET DEFAULT 'visitor';--> statement-breakpoint
ALTER TABLE "course_members" ALTER COLUMN "role" SET DEFAULT 'visitor';--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "preferred_locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "ror_id" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "canonical_name" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "normalized_name" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "acronyms" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "organization_type" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "country_name" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "domains" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "primary_domain" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "website_url" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "external_source" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "external_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "course_coownership_requests" ADD CONSTRAINT "course_coownership_requests_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_coownership_requests" ADD CONSTRAINT "course_coownership_requests_requester_id_students_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_coownership_requests" ADD CONSTRAINT "course_coownership_requests_reviewer_id_students_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_local_organization_id_universities_id_fk" FOREIGN KEY ("local_organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_reviewed_by_students_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_coownership_pending" ON "course_coownership_requests" USING btree ("course_page_id","requester_id") WHERE "course_coownership_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "idx_course_coownership_owner_queue" ON "course_coownership_requests" USING btree ("course_page_id","status","requested_at");--> statement-breakpoint
CREATE INDEX "idx_course_coownership_requester" ON "course_coownership_requests" USING btree ("requester_id","status");--> statement-breakpoint
CREATE INDEX "idx_organization_requests_queue" ON "organization_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_organization_requests_student" ON "organization_requests" USING btree ("student_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_enrollments_one_primary" ON "enrollments" USING btree ("student_id") WHERE "enrollments"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_universities_ror_id" ON "universities" USING btree ("ror_id") WHERE "universities"."ror_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_universities_normalized_name" ON "universities" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "idx_universities_country" ON "universities" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "idx_universities_type" ON "universities" USING btree ("organization_type");--> statement-breakpoint
CREATE INDEX "idx_universities_domain" ON "universities" USING btree ("primary_domain");--> statement-breakpoint
CREATE INDEX "idx_university_programs_organization" ON "university_programs" USING btree ("university_id");