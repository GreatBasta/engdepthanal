CREATE TYPE "public"."coverage_answer" AS ENUM('yes_depth', 'yes_brief', 'no', 'unsure');--> statement-breakpoint
CREATE TYPE "public"."coverage_verdict" AS ENUM('taught', 'partially_taught', 'not_taught', 'insufficient_data');--> statement-breakpoint
CREATE TYPE "public"."depth_level" AS ENUM('awareness', 'procedural', 'fluency', 'proof');--> statement-breakpoint
CREATE TYPE "public"."enrollment_phase" AS ENUM('starting', 'attending');--> statement-breakpoint
CREATE TYPE "public"."progress_state" AS ENUM('not_started', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."subject_status" AS ENUM('not_started', 'in_progress', 'finished');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "coverage_aggregates" (
	"university_program_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"subtopic_id" uuid NOT NULL,
	"n" integer NOT NULL,
	"pct_covered" numeric(5, 2) NOT NULL,
	"pct_in_depth" numeric(5, 2) NOT NULL,
	"avg_grade_normalized" numeric(5, 2),
	"verdict" "coverage_verdict" NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coverage_aggregates_university_program_id_subject_id_subtopic_id_pk" PRIMARY KEY("university_program_id","subject_id","subtopic_id")
);
--> statement-breakpoint
CREATE TABLE "coverage_responses" (
	"subject_enrollment_id" uuid NOT NULL,
	"subtopic_id" uuid NOT NULL,
	"answer" "coverage_answer" NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coverage_responses_subject_enrollment_id_subtopic_id_pk" PRIMARY KEY("subject_enrollment_id","subtopic_id")
);
--> statement-breakpoint
CREATE TABLE "curriculum_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"topic_id" uuid,
	"student_id" uuid NOT NULL,
	"body" text NOT NULL,
	"status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"university_program_id" uuid NOT NULL,
	"intake_year" smallint NOT NULL,
	"phase" "enrollment_phase" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_student_id_university_program_id_intake_year_unique" UNIQUE("student_id","university_program_id","intake_year")
);
--> statement-breakpoint
CREATE TABLE "grade_scales" (
	"scale" text NOT NULL,
	"raw_value" text NOT NULL,
	"normalized" numeric(5, 2) NOT NULL,
	CONSTRAINT "grade_scales_scale_raw_value_pk" PRIMARY KEY("scale","raw_value")
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" "verification_status" DEFAULT 'verified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "subject_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"status" "subject_status" DEFAULT 'not_started' NOT NULL,
	"finished_at" timestamp with time zone,
	"grade_value" text,
	"grade_scale" text,
	"grade_normalized" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_enrollments_enrollment_id_subject_id_unique" UNIQUE("enrollment_id","subject_id"),
	CONSTRAINT "finished_has_date" CHECK ("subject_enrollments"."status" <> 'finished' or "subject_enrollments"."finished_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"year" smallint DEFAULT 1 NOT NULL,
	"position" smallint NOT NULL,
	"min_sample_size" smallint DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subjects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subtopic_prerequisites" (
	"subtopic_id" uuid NOT NULL,
	"prerequisite_id" uuid NOT NULL,
	CONSTRAINT "subtopic_prerequisites_subtopic_id_prerequisite_id_pk" PRIMARY KEY("subtopic_id","prerequisite_id"),
	CONSTRAINT "no_self_prereq" CHECK ("subtopic_prerequisites"."subtopic_id" <> "subtopic_prerequisites"."prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE "subtopic_progress" (
	"subject_enrollment_id" uuid NOT NULL,
	"subtopic_id" uuid NOT NULL,
	"state" "progress_state" DEFAULT 'not_started' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subtopic_progress_subject_enrollment_id_subtopic_id_pk" PRIMARY KEY("subject_enrollment_id","subtopic_id")
);
--> statement-breakpoint
CREATE TABLE "subtopics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"depth_level" "depth_level" NOT NULL,
	"est_hours" numeric(4, 1),
	"position" smallint NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "subtopics_topic_id_slug_unique" UNIQUE("topic_id","slug")
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" smallint NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "topics_subject_id_slug_unique" UNIQUE("subject_id","slug")
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"country_code" char(2) NOT NULL,
	"city" text,
	"status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "universities_name_country_code_unique" UNIQUE("name","country_code")
);
--> statement-breakpoint
CREATE TABLE "university_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"university_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"local_name" text,
	"status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "university_programs_university_id_program_id_unique" UNIQUE("university_id","program_id")
);
--> statement-breakpoint
ALTER TABLE "coverage_aggregates" ADD CONSTRAINT "coverage_aggregates_university_program_id_university_programs_id_fk" FOREIGN KEY ("university_program_id") REFERENCES "public"."university_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_aggregates" ADD CONSTRAINT "coverage_aggregates_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_aggregates" ADD CONSTRAINT "coverage_aggregates_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_responses" ADD CONSTRAINT "coverage_responses_subject_enrollment_id_subject_enrollments_id_fk" FOREIGN KEY ("subject_enrollment_id") REFERENCES "public"."subject_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coverage_responses" ADD CONSTRAINT "coverage_responses_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_suggestions" ADD CONSTRAINT "curriculum_suggestions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_suggestions" ADD CONSTRAINT "curriculum_suggestions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_university_program_id_university_programs_id_fk" FOREIGN KEY ("university_program_id") REFERENCES "public"."university_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_enrollments" ADD CONSTRAINT "subject_enrollments_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_enrollments" ADD CONSTRAINT "subject_enrollments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_prerequisites" ADD CONSTRAINT "subtopic_prerequisites_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_prerequisites" ADD CONSTRAINT "subtopic_prerequisites_prerequisite_id_subtopics_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_progress" ADD CONSTRAINT "subtopic_progress_subject_enrollment_id_subject_enrollments_id_fk" FOREIGN KEY ("subject_enrollment_id") REFERENCES "public"."subject_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_progress" ADD CONSTRAINT "subtopic_progress_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopics" ADD CONSTRAINT "subtopics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_programs" ADD CONSTRAINT "university_programs_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "university_programs" ADD CONSTRAINT "university_programs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aggregates_gaps" ON "coverage_aggregates" USING btree ("university_program_id","subject_id") WHERE verdict = 'not_taught';--> statement-breakpoint
CREATE INDEX "idx_responses_subtopic" ON "coverage_responses" USING btree ("subtopic_id");--> statement-breakpoint
CREATE INDEX "idx_enrollments_student" ON "enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_subj_enroll_status" ON "subject_enrollments" USING btree ("subject_id","status");--> statement-breakpoint
CREATE INDEX "idx_subtopics_topic" ON "subtopics" USING btree ("topic_id","position");--> statement-breakpoint
CREATE INDEX "idx_topics_subject" ON "topics" USING btree ("subject_id","position");