CREATE TYPE "public"."candidate_match_status" AS ENUM('suggested', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."catalog_candidate_status" AS ENUM('candidate', 'confirmed', 'rejected', 'outdated', 'merged');--> statement-breakpoint
CREATE TYPE "public"."catalog_correction_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."catalog_scan_status" AS ENUM('queued', 'running', 'completed', 'partial', 'failed');--> statement-breakpoint
CREATE TYPE "public"."catalog_source_type" AS ENUM('official_api', 'structured_data', 'sitemap', 'official_catalog', 'official_pdf', 'manual');--> statement-breakpoint
CREATE TYPE "public"."metadata_change_review_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."robots_permission_status" AS ENUM('unknown', 'allowed', 'disallowed', 'unavailable', 'error');--> statement-breakpoint
CREATE TABLE "course_candidate_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_candidate_id" uuid NOT NULL,
	"proposed_by" uuid NOT NULL,
	"note" text NOT NULL,
	"proposed_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "catalog_correction_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_candidate_matches" (
	"course_candidate_id" uuid NOT NULL,
	"course_page_id" uuid NOT NULL,
	"score" numeric(4, 3) NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "candidate_match_status" DEFAULT 'suggested' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_candidate_matches_course_candidate_id_course_page_id_pk" PRIMARY KEY("course_candidate_id","course_page_id")
);
--> statement-breakpoint
CREATE TABLE "course_metadata_change_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"course_candidate_id" uuid NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"changed_fields" jsonb NOT NULL,
	"status" "metadata_change_review_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_course_metadata_review_snapshot" UNIQUE("course_page_id","course_candidate_id","snapshot_id")
);
--> statement-breakpoint
CREATE TABLE "course_source_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"course_candidate_id" uuid,
	"previous_snapshot_id" uuid,
	"source_url" text NOT NULL,
	"http_status" smallint,
	"content_type" text,
	"http_etag" text,
	"http_last_modified" text,
	"content_checksum" text NOT NULL,
	"normalized_data" jsonb NOT NULL,
	"extracted_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"changed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_catalog_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"boundary_source" text NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"evidence_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_catalog_domain_organization" UNIQUE("organization_id","domain")
);
--> statement-breakpoint
CREATE TABLE "organization_catalog_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"requested_by" uuid,
	"scan_key" text NOT NULL,
	"workflow_run_id" text,
	"status" "catalog_scan_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"current_source_id" uuid,
	"checkpoint" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pages_inspected" integer DEFAULT 0 NOT NULL,
	"units_found" integer DEFAULT 0 NOT NULL,
	"programmes_found" integer DEFAULT 0 NOT NULL,
	"courses_found" integer DEFAULT 0 NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure_summary" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_catalog_scans_scan_key_unique" UNIQUE("scan_key")
);
--> statement-breakpoint
CREATE TABLE "organization_catalog_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"source_type" "catalog_source_type" NOT NULL,
	"connector_id" text NOT NULL,
	"domain" text NOT NULL,
	"domain_approved" boolean DEFAULT false NOT NULL,
	"robots_status" "robots_permission_status" DEFAULT 'unknown' NOT NULL,
	"robots_checked_at" timestamp with time zone,
	"last_successful_scan_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_failure" text,
	"http_etag" text,
	"http_last_modified" text,
	"content_checksum" text,
	"connector_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_catalog_source_url" UNIQUE("organization_id","source_url")
);
--> statement-breakpoint
CREATE TABLE "organization_course_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"last_seen_scan_id" uuid NOT NULL,
	"programme_candidate_id" uuid,
	"source_url" text NOT NULL,
	"source_type" "catalog_source_type" NOT NULL,
	"external_source_id" text,
	"course_code" text,
	"normalized_course_code" text,
	"canonical_source_name" text NOT NULL,
	"local_display_name" text,
	"normalized_course_name" text NOT NULL,
	"description" text,
	"credits" numeric(6, 2),
	"language_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"department" text,
	"degree_programme" text,
	"academic_year" text,
	"semester" text,
	"professor_name" text,
	"campus" text,
	"official_url" text NOT NULL,
	"fallback_dedup_key" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"status" "catalog_candidate_status" DEFAULT 'candidate' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"verification_method" text,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_updated_at" timestamp with time zone,
	"last_discovered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_program_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"last_seen_scan_id" uuid NOT NULL,
	"unit_candidate_id" uuid,
	"external_source_id" text,
	"canonical_source_name" text NOT NULL,
	"local_display_name" text,
	"degree_level" "degree_level",
	"academic_field_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credits" numeric(6, 1),
	"duration_years" numeric(3, 1),
	"official_url" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"status" "catalog_candidate_status" DEFAULT 'candidate' NOT NULL,
	"first_discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_program_candidate_url" UNIQUE("organization_id","official_url")
);
--> statement-breakpoint
CREATE TABLE "organization_unit_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"last_seen_scan_id" uuid NOT NULL,
	"external_source_id" text,
	"parent_external_source_id" text,
	"unit_type" "organizational_unit_type" DEFAULT 'other' NOT NULL,
	"canonical_source_name" text NOT NULL,
	"localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"official_url" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"status" "catalog_candidate_status" DEFAULT 'candidate' NOT NULL,
	"first_discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_unit_candidate_url" UNIQUE("organization_id","official_url")
);
--> statement-breakpoint
DROP INDEX "uq_official_offering_external";--> statement-breakpoint
ALTER TABLE "official_course_offerings" ADD COLUMN "course_candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "course_candidate_corrections" ADD CONSTRAINT "course_candidate_corrections_course_candidate_id_organization_course_candidates_id_fk" FOREIGN KEY ("course_candidate_id") REFERENCES "public"."organization_course_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_candidate_corrections" ADD CONSTRAINT "course_candidate_corrections_proposed_by_students_id_fk" FOREIGN KEY ("proposed_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_candidate_corrections" ADD CONSTRAINT "course_candidate_corrections_reviewed_by_students_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_candidate_matches" ADD CONSTRAINT "course_candidate_matches_course_candidate_id_organization_course_candidates_id_fk" FOREIGN KEY ("course_candidate_id") REFERENCES "public"."organization_course_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_candidate_matches" ADD CONSTRAINT "course_candidate_matches_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_candidate_matches" ADD CONSTRAINT "course_candidate_matches_reviewed_by_students_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_metadata_change_reviews" ADD CONSTRAINT "course_metadata_change_reviews_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_metadata_change_reviews" ADD CONSTRAINT "course_metadata_change_reviews_course_candidate_id_organization_course_candidates_id_fk" FOREIGN KEY ("course_candidate_id") REFERENCES "public"."organization_course_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_metadata_change_reviews" ADD CONSTRAINT "course_metadata_change_reviews_snapshot_id_course_source_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."course_source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_metadata_change_reviews" ADD CONSTRAINT "course_metadata_change_reviews_reviewed_by_students_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_source_snapshots" ADD CONSTRAINT "course_source_snapshots_source_id_organization_catalog_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."organization_catalog_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_source_snapshots" ADD CONSTRAINT "course_source_snapshots_scan_id_organization_catalog_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."organization_catalog_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_source_snapshots" ADD CONSTRAINT "course_source_snapshots_course_candidate_id_organization_course_candidates_id_fk" FOREIGN KEY ("course_candidate_id") REFERENCES "public"."organization_course_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_source_snapshots" ADD CONSTRAINT "course_source_snapshots_previous_snapshot_id_course_source_snapshots_id_fk" FOREIGN KEY ("previous_snapshot_id") REFERENCES "public"."course_source_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_catalog_domains" ADD CONSTRAINT "organization_catalog_domains_organization_id_universities_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_catalog_domains" ADD CONSTRAINT "organization_catalog_domains_approved_by_students_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_catalog_scans" ADD CONSTRAINT "organization_catalog_scans_organization_id_universities_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_catalog_scans" ADD CONSTRAINT "organization_catalog_scans_requested_by_students_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_catalog_scans" ADD CONSTRAINT "organization_catalog_scans_current_source_id_organization_catalog_sources_id_fk" FOREIGN KEY ("current_source_id") REFERENCES "public"."organization_catalog_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_catalog_sources" ADD CONSTRAINT "organization_catalog_sources_organization_id_universities_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_catalog_sources" ADD CONSTRAINT "organization_catalog_sources_approved_by_students_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_course_candidates" ADD CONSTRAINT "organization_course_candidates_organization_id_universities_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_course_candidates" ADD CONSTRAINT "organization_course_candidates_source_id_organization_catalog_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."organization_catalog_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_course_candidates" ADD CONSTRAINT "organization_course_candidates_last_seen_scan_id_organization_catalog_scans_id_fk" FOREIGN KEY ("last_seen_scan_id") REFERENCES "public"."organization_catalog_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_course_candidates" ADD CONSTRAINT "organization_course_candidates_programme_candidate_id_organization_program_candidates_id_fk" FOREIGN KEY ("programme_candidate_id") REFERENCES "public"."organization_program_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_course_candidates" ADD CONSTRAINT "organization_course_candidates_reviewed_by_students_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_program_candidates" ADD CONSTRAINT "organization_program_candidates_organization_id_universities_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_program_candidates" ADD CONSTRAINT "organization_program_candidates_source_id_organization_catalog_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."organization_catalog_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_program_candidates" ADD CONSTRAINT "organization_program_candidates_last_seen_scan_id_organization_catalog_scans_id_fk" FOREIGN KEY ("last_seen_scan_id") REFERENCES "public"."organization_catalog_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_program_candidates" ADD CONSTRAINT "organization_program_candidates_unit_candidate_id_organization_unit_candidates_id_fk" FOREIGN KEY ("unit_candidate_id") REFERENCES "public"."organization_unit_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_unit_candidates" ADD CONSTRAINT "organization_unit_candidates_organization_id_universities_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_unit_candidates" ADD CONSTRAINT "organization_unit_candidates_source_id_organization_catalog_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."organization_catalog_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_unit_candidates" ADD CONSTRAINT "organization_unit_candidates_last_seen_scan_id_organization_catalog_scans_id_fk" FOREIGN KEY ("last_seen_scan_id") REFERENCES "public"."organization_catalog_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_course_candidate_corrections_review" ON "course_candidate_corrections" USING btree ("course_candidate_id","status");--> statement-breakpoint
CREATE INDEX "idx_candidate_matches_course" ON "course_candidate_matches" USING btree ("course_page_id","status");--> statement-breakpoint
CREATE INDEX "idx_course_metadata_reviews_pending" ON "course_metadata_change_reviews" USING btree ("course_page_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_snapshot_candidate_checksum" ON "course_source_snapshots" USING btree ("course_candidate_id","content_checksum") WHERE "course_source_snapshots"."course_candidate_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_course_snapshots_candidate" ON "course_source_snapshots" USING btree ("course_candidate_id","fetched_at");--> statement-breakpoint
CREATE INDEX "idx_catalog_domains_approved" ON "organization_catalog_domains" USING btree ("organization_id","approved");--> statement-breakpoint
CREATE INDEX "idx_catalog_scans_organization" ON "organization_catalog_scans" USING btree ("organization_id","status","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_catalog_scan_active_organization" ON "organization_catalog_scans" USING btree ("organization_id") WHERE "organization_catalog_scans"."status" in ('queued', 'running');--> statement-breakpoint
CREATE INDEX "idx_catalog_sources_active" ON "organization_catalog_sources" USING btree ("organization_id","active","source_type");--> statement-breakpoint
CREATE INDEX "idx_catalog_sources_domain" ON "organization_catalog_sources" USING btree ("domain","domain_approved");--> statement-breakpoint
CREATE INDEX "idx_course_candidates_review" ON "organization_course_candidates" USING btree ("organization_id","status","confidence");--> statement-breakpoint
CREATE INDEX "idx_course_candidates_programme" ON "organization_course_candidates" USING btree ("programme_candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_candidate_external_year" ON "organization_course_candidates" USING btree ("organization_id","external_source_id",coalesce("academic_year", '')) WHERE "organization_course_candidates"."external_source_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_candidate_code_year" ON "organization_course_candidates" USING btree ("organization_id","normalized_course_code",coalesce("academic_year", '')) WHERE "organization_course_candidates"."normalized_course_code" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_candidate_url_year" ON "organization_course_candidates" USING btree ("organization_id","official_url",coalesce("academic_year", ''));--> statement-breakpoint
CREATE INDEX "idx_course_candidate_fallback" ON "organization_course_candidates" USING btree ("organization_id","fallback_dedup_key");--> statement-breakpoint
CREATE INDEX "idx_program_candidates_review" ON "organization_program_candidates" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_program_candidate_external" ON "organization_program_candidates" USING btree ("organization_id","external_source_id") WHERE "organization_program_candidates"."external_source_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_unit_candidates_review" ON "organization_unit_candidates" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_unit_candidate_external" ON "organization_unit_candidates" USING btree ("organization_id","external_source_id") WHERE "organization_unit_candidates"."external_source_id" is not null;--> statement-breakpoint
ALTER TABLE "official_course_offerings" ADD CONSTRAINT "official_course_offerings_course_candidate_id_organization_course_candidates_id_fk" FOREIGN KEY ("course_candidate_id") REFERENCES "public"."organization_course_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_official_offering_candidate" ON "official_course_offerings" USING btree ("course_candidate_id") WHERE "official_course_offerings"."course_candidate_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_official_offering_external_year" ON "official_course_offerings" USING btree ("organization_id","external_source_id","academic_year") WHERE "official_course_offerings"."external_source_id" is not null;