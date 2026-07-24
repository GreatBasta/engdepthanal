CREATE TYPE "public"."not_studied_reason" AS ENUM('not_covered', 'not_reached', 'skipped');--> statement-breakpoint
CREATE TABLE "subtopic_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subtopic_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"university_program_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subtopic_stars" (
	"student_id" uuid NOT NULL,
	"subtopic_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subtopic_stars_student_id_subtopic_id_pk" PRIMARY KEY("student_id","subtopic_id")
);
--> statement-breakpoint
ALTER TABLE "coverage_responses" ADD COLUMN "difficulty" smallint;--> statement-breakpoint
ALTER TABLE "coverage_responses" ADD COLUMN "studied_depth" "depth_level";--> statement-breakpoint
ALTER TABLE "coverage_responses" ADD COLUMN "not_studied_reason" "not_studied_reason";--> statement-breakpoint
ALTER TABLE "subtopic_comments" ADD CONSTRAINT "subtopic_comments_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_comments" ADD CONSTRAINT "subtopic_comments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_comments" ADD CONSTRAINT "subtopic_comments_university_program_id_university_programs_id_fk" FOREIGN KEY ("university_program_id") REFERENCES "public"."university_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_stars" ADD CONSTRAINT "subtopic_stars_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtopic_stars" ADD CONSTRAINT "subtopic_stars_subtopic_id_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_comments_subtopic" ON "subtopic_comments" USING btree ("subtopic_id","university_program_id");