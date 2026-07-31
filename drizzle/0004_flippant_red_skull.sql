CREATE TYPE "public"."course_progress_state" AS ENUM('not_started', 'learning', 'completed', 'saved');--> statement-breakpoint
CREATE TYPE "public"."course_resource_context" AS ENUM('course', 'topic', 'subtopic', 'exam');--> statement-breakpoint
CREATE TYPE "public"."course_resource_type" AS ENUM('text_note', 'link', 'image', 'pdf', 'short_comment', 'study_tip', 'correction', 'personal_notes', 'permitted_material');--> statement-breakpoint
ALTER TYPE "public"."content_target_type" ADD VALUE 'course_resource' BEFORE 'attachment';--> statement-breakpoint
ALTER TYPE "public"."content_target_type" ADD VALUE 'resource_comment' BEFORE 'attachment';--> statement-breakpoint
CREATE TABLE "course_resource_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_resource_reactions" (
	"resource_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "course_reaction_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_resource_reactions_resource_id_student_id_kind_pk" PRIMARY KEY("resource_id","student_id","kind")
);
--> statement-breakpoint
CREATE TABLE "course_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"context" "course_resource_context" DEFAULT 'course' NOT NULL,
	"course_topic_stable_id" uuid,
	"course_subtopic_stable_id" uuid,
	"type" "course_resource_type" NOT NULL,
	"title" text,
	"body" text,
	"link_url" text,
	"permission_confirmed" boolean DEFAULT false NOT NULL,
	"hidden_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resource_context_target" CHECK (
        ("course_resources"."context" = 'course' and "course_resources"."course_topic_stable_id" is null and "course_resources"."course_subtopic_stable_id" is null)
        or ("course_resources"."context" = 'topic' and "course_resources"."course_topic_stable_id" is not null and "course_resources"."course_subtopic_stable_id" is null)
        or ("course_resources"."context" = 'subtopic' and "course_resources"."course_subtopic_stable_id" is not null)
        or ("course_resources"."context" = 'exam' and "course_resources"."course_topic_stable_id" is null and "course_resources"."course_subtopic_stable_id" is null)
      )
);
--> statement-breakpoint
CREATE TABLE "course_subtopic_progress" (
	"course_page_id" uuid NOT NULL,
	"course_subtopic_stable_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"state" "course_progress_state" DEFAULT 'not_started' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_subtopic_progress_course_page_id_course_subtopic_stable_id_student_id_pk" PRIMARY KEY("course_page_id","course_subtopic_stable_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "course_exam_materials" ADD COLUMN "permission_confirmed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_exam_profiles" ADD COLUMN "last_verified_academic_year" text;--> statement-breakpoint
ALTER TABLE "course_exam_profiles" ADD COLUMN "verification_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "course_exam_profiles" ADD COLUMN "student_reported" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "category" text DEFAULT 'engineering-core' NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "discipline_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "recommended_degree_programs" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "typical_year" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "typical_semester" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD COLUMN "source_references" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD COLUMN "question_type" text;--> statement-breakpoint
ALTER TABLE "question_occurrences" ADD COLUMN "professor_name" text;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "admin_role" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "template_subtopics" ADD COLUMN "optional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_resource_comments" ADD CONSTRAINT "course_resource_comments_resource_id_course_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."course_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_resource_comments" ADD CONSTRAINT "course_resource_comments_author_id_students_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_resource_reactions" ADD CONSTRAINT "course_resource_reactions_resource_id_course_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."course_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_resource_reactions" ADD CONSTRAINT "course_resource_reactions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_resources" ADD CONSTRAINT "course_resources_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_resources" ADD CONSTRAINT "course_resources_author_id_students_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_subtopic_progress" ADD CONSTRAINT "course_subtopic_progress_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_subtopic_progress" ADD CONSTRAINT "course_subtopic_progress_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_resource_comments" ON "course_resource_comments" USING btree ("resource_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_course_resources_feed" ON "course_resources" USING btree ("course_page_id","context","created_at");--> statement-breakpoint
CREATE INDEX "idx_course_resources_subtopic" ON "course_resources" USING btree ("course_page_id","course_subtopic_stable_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_course_progress_student" ON "course_subtopic_progress" USING btree ("student_id","course_page_id");