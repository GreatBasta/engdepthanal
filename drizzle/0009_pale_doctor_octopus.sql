CREATE TYPE "public"."academic_field_level" AS ENUM('domain', 'broad_field', 'discipline', 'subdiscipline', 'professional_area');--> statement-breakpoint
CREATE TYPE "public"."degree_level" AS ENUM('bachelor', 'master', 'single_cycle', 'doctoral', 'professional', 'other');--> statement-breakpoint
CREATE TYPE "public"."official_offering_status" AS ENUM('active', 'outdated', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."organizational_unit_type" AS ENUM('faculty', 'school', 'college', 'department', 'institute', 'division', 'academy', 'campus', 'other');--> statement-breakpoint
CREATE TABLE "academic_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stable_key" text NOT NULL,
	"parent_id" uuid,
	"level" "academic_field_level" NOT NULL,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aliases" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"typical_degree_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"classification_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_fields_stable_key_unique" UNIQUE("stable_key")
);
--> statement-breakpoint
CREATE TABLE "degree_programme_academic_fields" (
	"degree_programme_id" uuid NOT NULL,
	"academic_field_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "degree_programme_academic_fields_degree_programme_id_academic_field_id_pk" PRIMARY KEY("degree_programme_id","academic_field_id")
);
--> statement-breakpoint
CREATE TABLE "degree_programmes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"organizational_unit_id" uuid,
	"external_source_id" text,
	"canonical_name" text NOT NULL,
	"localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"degree_level" "degree_level",
	"official_url" text,
	"language_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credits" numeric(6, 1),
	"duration_years" numeric(3, 1),
	"source_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_updated_at" timestamp with time zone,
	"status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "official_course_offerings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"degree_programme_id" uuid,
	"organizational_unit_id" uuid,
	"external_source_id" text,
	"course_code" text,
	"canonical_source_name" text NOT NULL,
	"local_display_name" text,
	"description" text,
	"credits" numeric(6, 2),
	"language_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"academic_year" text,
	"semester" text,
	"professor_name" text,
	"campus" text,
	"official_url" text NOT NULL,
	"source_type" text NOT NULL,
	"confidence" numeric(4, 3) NOT NULL,
	"verification_status" "verification_status" DEFAULT 'verified' NOT NULL,
	"offering_status" "official_offering_status" DEFAULT 'active' NOT NULL,
	"source_updated_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizational_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_id" uuid,
	"unit_type" "organizational_unit_type" NOT NULL,
	"canonical_name" text NOT NULL,
	"localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"external_source_id" text,
	"official_url" text,
	"source_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_academic_fields" (
	"program_id" uuid NOT NULL,
	"academic_field_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "program_academic_fields_program_id_academic_field_id_pk" PRIMARY KEY("program_id","academic_field_id")
);
--> statement-breakpoint
ALTER TABLE "course_pages" ADD COLUMN "official_offering_id" uuid;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "academic_domain_key" text;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "typical_degree_levels" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "typical_stage" text;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "curricular_status" text DEFAULT 'core' NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "validation_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "academic_context" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "aliases" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "typical_degree_levels" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "degree_programme_id" uuid;--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "organizational_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "localized_names" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "degree_level" "degree_level";--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "external_source_id" text;--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "official_url" text;--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "language_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "credits" numeric(6, 1);--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "duration_years" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "source_evidence" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "university_programs" ADD COLUMN "source_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "academic_fields" ADD CONSTRAINT "academic_fields_parent_id_academic_fields_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."academic_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "degree_programme_academic_fields" ADD CONSTRAINT "degree_programme_academic_fields_degree_programme_id_degree_programmes_id_fk" FOREIGN KEY ("degree_programme_id") REFERENCES "public"."degree_programmes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "degree_programme_academic_fields" ADD CONSTRAINT "degree_programme_academic_fields_academic_field_id_academic_fields_id_fk" FOREIGN KEY ("academic_field_id") REFERENCES "public"."academic_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "degree_programmes" ADD CONSTRAINT "degree_programmes_organization_id_universities_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "degree_programmes" ADD CONSTRAINT "degree_programmes_organizational_unit_id_organizational_units_id_fk" FOREIGN KEY ("organizational_unit_id") REFERENCES "public"."organizational_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_course_offerings" ADD CONSTRAINT "official_course_offerings_organization_id_universities_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_course_offerings" ADD CONSTRAINT "official_course_offerings_degree_programme_id_degree_programmes_id_fk" FOREIGN KEY ("degree_programme_id") REFERENCES "public"."degree_programmes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_course_offerings" ADD CONSTRAINT "official_course_offerings_organizational_unit_id_organizational_units_id_fk" FOREIGN KEY ("organizational_unit_id") REFERENCES "public"."organizational_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_organization_id_universities_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizational_units" ADD CONSTRAINT "organizational_units_parent_id_organizational_units_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."organizational_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_academic_fields" ADD CONSTRAINT "program_academic_fields_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_academic_fields" ADD CONSTRAINT "program_academic_fields_academic_field_id_academic_fields_id_fk" FOREIGN KEY ("academic_field_id") REFERENCES "public"."academic_fields"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_academic_fields_parent" ON "academic_fields" USING btree ("parent_id","level");--> statement-breakpoint
CREATE INDEX "idx_academic_fields_active" ON "academic_fields" USING btree ("active","level");--> statement-breakpoint
CREATE INDEX "idx_degree_programme_fields_field" ON "degree_programme_academic_fields" USING btree ("academic_field_id");--> statement-breakpoint
CREATE INDEX "idx_degree_programmes_organization" ON "degree_programmes" USING btree ("organization_id","degree_level","status");--> statement-breakpoint
CREATE INDEX "idx_degree_programmes_unit" ON "degree_programmes" USING btree ("organizational_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_degree_programme_external" ON "degree_programmes" USING btree ("organization_id","external_source_id") WHERE "degree_programmes"."external_source_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_degree_programme_url" ON "degree_programmes" USING btree ("organization_id","official_url") WHERE "degree_programmes"."official_url" is not null;--> statement-breakpoint
CREATE INDEX "idx_official_offerings_directory" ON "official_course_offerings" USING btree ("organization_id","academic_year","offering_status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_official_offering_external" ON "official_course_offerings" USING btree ("organization_id","external_source_id") WHERE "official_course_offerings"."external_source_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_official_offering_url_year" ON "official_course_offerings" USING btree ("organization_id","official_url","academic_year") WHERE "official_course_offerings"."academic_year" is not null;--> statement-breakpoint
CREATE INDEX "idx_organizational_units_organization" ON "organizational_units" USING btree ("organization_id","unit_type");--> statement-breakpoint
CREATE INDEX "idx_organizational_units_parent" ON "organizational_units" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_organizational_unit_external" ON "organizational_units" USING btree ("organization_id","external_source_id") WHERE "organizational_units"."external_source_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_program_academic_fields_field" ON "program_academic_fields" USING btree ("academic_field_id");--> statement-breakpoint
ALTER TABLE "course_pages" ADD CONSTRAINT "course_pages_official_offering_id_official_course_offerings_id_fk" FOREIGN KEY ("official_offering_id") REFERENCES "public"."official_course_offerings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_programs" ADD CONSTRAINT "university_programs_organizational_unit_id_organizational_units_id_fk" FOREIGN KEY ("organizational_unit_id") REFERENCES "public"."organizational_units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_page_official_offering" ON "course_pages" USING btree ("official_offering_id") WHERE "course_pages"."official_offering_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_university_programs_unit" ON "university_programs" USING btree ("organizational_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_university_program_external" ON "university_programs" USING btree ("university_id","external_source_id") WHERE "university_programs"."external_source_id" is not null;