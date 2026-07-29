CREATE TYPE "public"."attachment_access" AS ENUM('public', 'course');--> statement-breakpoint
CREATE TYPE "public"."content_report_status" AS ENUM('open', 'reviewed', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TYPE "public"."content_target_type" AS ENUM('post', 'reply', 'attachment', 'exam_experience', 'exam_question', 'question_occurrence');--> statement-breakpoint
CREATE TYPE "public"."course_attendance" AS ENUM('attended', 'not_attended');--> statement-breakpoint
CREATE TYPE "public"."course_content_provenance" AS ENUM('template', 'course');--> statement-breakpoint
CREATE TYPE "public"."course_coverage_state" AS ENUM('unknown', 'covered', 'not_covered');--> statement-breakpoint
CREATE TYPE "public"."course_invite_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."course_member_role" AS ENUM('owner', 'editor', 'contributor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."course_post_kind" AS ENUM('discussion', 'resource', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."course_reaction_kind" AS ENUM('like', 'helpful', 'insightful');--> statement-breakpoint
CREATE TYPE "public"."course_visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TYPE "public"."curriculum_version_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."exam_assessment_type" AS ENUM('written', 'oral', 'practical', 'project', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."exam_merge_request_status" AS ENUM('open', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."exam_question_status" AS ENUM('active', 'merged', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."moderation_action_type" AS ENUM('hide', 'restore', 'lock', 'unlock', 'remove_member', 'resolve_report');--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "content_target_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "content_report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "uq_content_reporter_target" UNIQUE("reporter_id","target_type","target_id")
);
--> statement-breakpoint
CREATE TABLE "course_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"parent_type" "content_target_type",
	"parent_id" uuid,
	"storage_key" text NOT NULL,
	"blob_url" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"access" "attachment_access" DEFAULT 'course' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "course_attachments_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "course_attachments_blob_url_unique" UNIQUE("blob_url"),
	CONSTRAINT "attachment_size_positive" CHECK ("course_attachments"."size_bytes" > 0),
	CONSTRAINT "attachment_parent_pair" CHECK (("course_attachments"."parent_type" is null) = ("course_attachments"."parent_id" is null))
);
--> statement-breakpoint
CREATE TABLE "course_curriculum_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "curriculum_version_status" DEFAULT 'draft' NOT NULL,
	"based_on_version_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "uq_course_curriculum_version" UNIQUE("course_page_id","version")
);
--> statement-breakpoint
CREATE TABLE "course_exam_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"attachment_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_exam_materials_attachment_id_unique" UNIQUE("attachment_id")
);
--> statement-breakpoint
CREATE TABLE "course_exam_profiles" (
	"course_page_id" uuid PRIMARY KEY NOT NULL,
	"assessment_type" "exam_assessment_type",
	"format" text,
	"grading_scale" text,
	"duration_minutes" integer,
	"open_book" boolean,
	"calculator_allowed" boolean,
	"details" text,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "course_member_role" DEFAULT 'viewer' NOT NULL,
	"attendance" "course_attendance" DEFAULT 'not_attended' NOT NULL,
	"token_hash" text NOT NULL,
	"status" "course_invite_status" DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"accepted_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "course_invites_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "course_members" (
	"course_page_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"role" "course_member_role" DEFAULT 'viewer' NOT NULL,
	"attendance" "course_attendance" DEFAULT 'not_attended' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_members_course_page_id_student_id_pk" PRIMARY KEY("course_page_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "course_page_templates" (
	"course_page_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"added_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_page_templates_course_page_id_template_id_pk" PRIMARY KEY("course_page_id","template_id"),
	CONSTRAINT "uq_course_template_position" UNIQUE("course_page_id","position")
);
--> statement-breakpoint
CREATE TABLE "course_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"university_program_id" uuid NOT NULL,
	"local_name" text NOT NULL,
	"course_code" text,
	"professor_name" text,
	"academic_year" text NOT NULL,
	"cohort_year" smallint,
	"semester" smallint,
	"description" text,
	"visibility" "course_visibility" DEFAULT 'private' NOT NULL,
	"duplicate_key" text NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "course_pages_slug_unique" UNIQUE("slug"),
	CONSTRAINT "course_semester_range" CHECK ("course_pages"."semester" is null or ("course_pages"."semester" >= 1 and "course_pages"."semester" <= 12))
);
--> statement-breakpoint
CREATE TABLE "course_post_reactions" (
	"post_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "course_reaction_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_post_reactions_post_id_student_id_kind_pk" PRIMARY KEY("post_id","student_id","kind")
);
--> statement-breakpoint
CREATE TABLE "course_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"kind" "course_post_kind" DEFAULT 'discussion' NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"pinned_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"parent_reply_id" uuid,
	"body" text NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_reply_reactions" (
	"reply_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" "course_reaction_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_reply_reactions_reply_id_student_id_kind_pk" PRIMARY KEY("reply_id","student_id","kind")
);
--> statement-breakpoint
CREATE TABLE "course_subtopic_prerequisites" (
	"subtopic_id" uuid NOT NULL,
	"prerequisite_id" uuid NOT NULL,
	CONSTRAINT "course_subtopic_prerequisites_subtopic_id_prerequisite_id_pk" PRIMARY KEY("subtopic_id","prerequisite_id"),
	CONSTRAINT "course_no_self_prereq" CHECK ("course_subtopic_prerequisites"."subtopic_id" <> "course_subtopic_prerequisites"."prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE "course_subtopics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_topic_id" uuid NOT NULL,
	"stable_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"source_template_subtopic_id" uuid,
	"provenance" "course_content_provenance" DEFAULT 'course' NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"depth_level" "depth_level" DEFAULT 'procedural' NOT NULL,
	"est_hours" numeric(4, 1),
	"position" integer NOT NULL,
	"coverage" "course_coverage_state" DEFAULT 'unknown' NOT NULL,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "uq_course_subtopic_stable" UNIQUE("course_topic_id","stable_id"),
	CONSTRAINT "uq_course_subtopic_slug" UNIQUE("course_topic_id","slug")
);
--> statement-breakpoint
CREATE TABLE "course_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"curriculum_version_id" uuid NOT NULL,
	"stable_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"source_template_topic_id" uuid,
	"provenance" "course_content_provenance" DEFAULT 'course' NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"hidden_at" timestamp with time zone,
	CONSTRAINT "uq_course_topic_stable" UNIQUE("curriculum_version_id","stable_id"),
	CONSTRAINT "uq_course_topic_slug" UNIQUE("curriculum_version_id","slug")
);
--> statement-breakpoint
CREATE TABLE "curriculum_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"year" smallint DEFAULT 1 NOT NULL,
	"source_subject_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_template_key_version" UNIQUE("template_key","version")
);
--> statement-breakpoint
CREATE TABLE "exam_experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"academic_year" text,
	"exam_date" date,
	"grade" text,
	"anonymous" boolean DEFAULT false NOT NULL,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_merge_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"source_question_id" uuid NOT NULL,
	"target_question_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"rationale" text NOT NULL,
	"status" "exam_merge_request_status" DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "uq_exam_merge_pair" UNIQUE("source_question_id","target_question_id","status"),
	CONSTRAINT "exam_merge_distinct_questions" CHECK ("exam_merge_requests"."source_question_id" <> "exam_merge_requests"."target_question_id")
);
--> statement-breakpoint
CREATE TABLE "exam_question_votes" (
	"question_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"value" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_question_votes_question_id_student_id_pk" PRIMARY KEY("question_id","student_id"),
	CONSTRAINT "exam_vote_value" CHECK ("exam_question_votes"."value" in (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"prompt" text NOT NULL,
	"answer_guidance" text,
	"course_topic_stable_id" uuid,
	"course_subtopic_stable_id" uuid,
	"difficulty" smallint,
	"status" "exam_question_status" DEFAULT 'active' NOT NULL,
	"merged_into_id" uuid,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_question_difficulty_range" CHECK ("exam_questions"."difficulty" is null or ("exam_questions"."difficulty" >= 1 and "exam_questions"."difficulty" <= 5)),
	CONSTRAINT "exam_question_merge_target" CHECK (("exam_questions"."status" = 'merged') = ("exam_questions"."merged_into_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_page_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"target_type" "content_target_type",
	"target_id" uuid,
	"action" "moderation_action_type" NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moderation_target_pair" CHECK (("moderation_actions"."target_type" is null) = ("moderation_actions"."target_id" is null))
);
--> statement-breakpoint
CREATE TABLE "question_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"reported_by" uuid NOT NULL,
	"experience_id" uuid,
	"session_label" text NOT NULL,
	"occurred_on" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_question_occurrence_report" UNIQUE("question_id","reported_by","session_label")
);
--> statement-breakpoint
CREATE TABLE "template_subtopic_prerequisites" (
	"subtopic_id" uuid NOT NULL,
	"prerequisite_id" uuid NOT NULL,
	CONSTRAINT "template_subtopic_prerequisites_subtopic_id_prerequisite_id_pk" PRIMARY KEY("subtopic_id","prerequisite_id"),
	CONSTRAINT "template_no_self_prereq" CHECK ("template_subtopic_prerequisites"."subtopic_id" <> "template_subtopic_prerequisites"."prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE "template_subtopics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_topic_id" uuid NOT NULL,
	"stable_key" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"depth_level" "depth_level" NOT NULL,
	"est_hours" numeric(4, 1),
	"position" integer NOT NULL,
	"source_subtopic_id" uuid,
	CONSTRAINT "uq_template_subtopic_key" UNIQUE("template_topic_id","stable_key"),
	CONSTRAINT "uq_template_subtopic_slug" UNIQUE("template_topic_id","slug")
);
--> statement-breakpoint
CREATE TABLE "template_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"stable_key" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"source_topic_id" uuid,
	CONSTRAINT "uq_template_topic_key" UNIQUE("template_id","stable_key"),
	CONSTRAINT "uq_template_topic_slug" UNIQUE("template_id","slug")
);
--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_students_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_resolved_by_students_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_attachments" ADD CONSTRAINT "course_attachments_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_attachments" ADD CONSTRAINT "course_attachments_uploader_id_students_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_curriculum_versions" ADD CONSTRAINT "course_curriculum_versions_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_curriculum_versions" ADD CONSTRAINT "course_curriculum_versions_created_by_students_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_exam_materials" ADD CONSTRAINT "course_exam_materials_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_exam_materials" ADD CONSTRAINT "course_exam_materials_attachment_id_course_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."course_attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_exam_materials" ADD CONSTRAINT "course_exam_materials_created_by_students_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_exam_profiles" ADD CONSTRAINT "course_exam_profiles_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_exam_profiles" ADD CONSTRAINT "course_exam_profiles_updated_by_students_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_invites" ADD CONSTRAINT "course_invites_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_invites" ADD CONSTRAINT "course_invites_created_by_students_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_invites" ADD CONSTRAINT "course_invites_accepted_by_students_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_members" ADD CONSTRAINT "course_members_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_members" ADD CONSTRAINT "course_members_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_page_templates" ADD CONSTRAINT "course_page_templates_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_page_templates" ADD CONSTRAINT "course_page_templates_template_id_curriculum_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."curriculum_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_page_templates" ADD CONSTRAINT "course_page_templates_added_by_students_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_pages" ADD CONSTRAINT "course_pages_university_program_id_university_programs_id_fk" FOREIGN KEY ("university_program_id") REFERENCES "public"."university_programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_pages" ADD CONSTRAINT "course_pages_created_by_students_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_post_reactions" ADD CONSTRAINT "course_post_reactions_post_id_course_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."course_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_post_reactions" ADD CONSTRAINT "course_post_reactions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_posts" ADD CONSTRAINT "course_posts_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_posts" ADD CONSTRAINT "course_posts_author_id_students_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_replies" ADD CONSTRAINT "course_replies_post_id_course_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."course_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_replies" ADD CONSTRAINT "course_replies_author_id_students_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_reply_reactions" ADD CONSTRAINT "course_reply_reactions_reply_id_course_replies_id_fk" FOREIGN KEY ("reply_id") REFERENCES "public"."course_replies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_reply_reactions" ADD CONSTRAINT "course_reply_reactions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_subtopic_prerequisites" ADD CONSTRAINT "course_subtopic_prerequisites_subtopic_id_course_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."course_subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_subtopic_prerequisites" ADD CONSTRAINT "course_subtopic_prerequisites_prerequisite_id_course_subtopics_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."course_subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_subtopics" ADD CONSTRAINT "course_subtopics_course_topic_id_course_topics_id_fk" FOREIGN KEY ("course_topic_id") REFERENCES "public"."course_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_subtopics" ADD CONSTRAINT "course_subtopics_source_template_subtopic_id_template_subtopics_id_fk" FOREIGN KEY ("source_template_subtopic_id") REFERENCES "public"."template_subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_curriculum_version_id_course_curriculum_versions_id_fk" FOREIGN KEY ("curriculum_version_id") REFERENCES "public"."course_curriculum_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_topics" ADD CONSTRAINT "course_topics_source_template_topic_id_template_topics_id_fk" FOREIGN KEY ("source_template_topic_id") REFERENCES "public"."template_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD CONSTRAINT "curriculum_templates_source_subject_id_subjects_id_fk" FOREIGN KEY ("source_subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_templates" ADD CONSTRAINT "curriculum_templates_created_by_students_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_experiences" ADD CONSTRAINT "exam_experiences_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_experiences" ADD CONSTRAINT "exam_experiences_author_id_students_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_merge_requests" ADD CONSTRAINT "exam_merge_requests_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_merge_requests" ADD CONSTRAINT "exam_merge_requests_source_question_id_exam_questions_id_fk" FOREIGN KEY ("source_question_id") REFERENCES "public"."exam_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_merge_requests" ADD CONSTRAINT "exam_merge_requests_target_question_id_exam_questions_id_fk" FOREIGN KEY ("target_question_id") REFERENCES "public"."exam_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_merge_requests" ADD CONSTRAINT "exam_merge_requests_requested_by_students_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_merge_requests" ADD CONSTRAINT "exam_merge_requests_reviewed_by_students_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_question_votes" ADD CONSTRAINT "exam_question_votes_question_id_exam_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."exam_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_question_votes" ADD CONSTRAINT "exam_question_votes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_created_by_students_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_course_page_id_course_pages_id_fk" FOREIGN KEY ("course_page_id") REFERENCES "public"."course_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_actor_id_students_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_occurrences" ADD CONSTRAINT "question_occurrences_question_id_exam_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."exam_questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_occurrences" ADD CONSTRAINT "question_occurrences_reported_by_students_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."students"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_occurrences" ADD CONSTRAINT "question_occurrences_experience_id_exam_experiences_id_fk" FOREIGN KEY ("experience_id") REFERENCES "public"."exam_experiences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_subtopic_prerequisites" ADD CONSTRAINT "template_subtopic_prerequisites_subtopic_id_template_subtopics_id_fk" FOREIGN KEY ("subtopic_id") REFERENCES "public"."template_subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_subtopic_prerequisites" ADD CONSTRAINT "template_subtopic_prerequisites_prerequisite_id_template_subtopics_id_fk" FOREIGN KEY ("prerequisite_id") REFERENCES "public"."template_subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_subtopics" ADD CONSTRAINT "template_subtopics_template_topic_id_template_topics_id_fk" FOREIGN KEY ("template_topic_id") REFERENCES "public"."template_topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_subtopics" ADD CONSTRAINT "template_subtopics_source_subtopic_id_subtopics_id_fk" FOREIGN KEY ("source_subtopic_id") REFERENCES "public"."subtopics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_topics" ADD CONSTRAINT "template_topics_template_id_curriculum_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."curriculum_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_topics" ADD CONSTRAINT "template_topics_source_topic_id_topics_id_fk" FOREIGN KEY ("source_topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_content_reports_queue" ON "content_reports" USING btree ("course_page_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_course_attachments_parent" ON "course_attachments" USING btree ("parent_type","parent_id");--> statement-breakpoint
CREATE INDEX "idx_course_attachments_course" ON "course_attachments" USING btree ("course_page_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_one_draft" ON "course_curriculum_versions" USING btree ("course_page_id") WHERE "course_curriculum_versions"."status" = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_course_one_published" ON "course_curriculum_versions" USING btree ("course_page_id") WHERE "course_curriculum_versions"."status" = 'published';--> statement-breakpoint
CREATE INDEX "idx_exam_materials_course" ON "course_exam_materials" USING btree ("course_page_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_course_invites_email" ON "course_invites" USING btree ("email","status");--> statement-breakpoint
CREATE INDEX "idx_course_invites_course" ON "course_invites" USING btree ("course_page_id","status");--> statement-breakpoint
CREATE INDEX "idx_course_members_student" ON "course_members" USING btree ("student_id","role");--> statement-breakpoint
CREATE INDEX "idx_course_pages_directory" ON "course_pages" USING btree ("visibility","university_program_id","academic_year","semester");--> statement-breakpoint
CREATE INDEX "idx_course_pages_duplicate" ON "course_pages" USING btree ("university_program_id","duplicate_key");--> statement-breakpoint
CREATE INDEX "idx_course_posts_feed" ON "course_posts" USING btree ("course_page_id","pinned_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_course_replies_post" ON "course_replies" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_course_subtopics_order" ON "course_subtopics" USING btree ("course_topic_id","position");--> statement-breakpoint
CREATE INDEX "idx_course_topics_order" ON "course_topics" USING btree ("curriculum_version_id","position");--> statement-breakpoint
CREATE INDEX "idx_templates_active" ON "curriculum_templates" USING btree ("is_active","year");--> statement-breakpoint
CREATE INDEX "idx_exam_experiences_course" ON "exam_experiences" USING btree ("course_page_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_exam_merge_queue" ON "exam_merge_requests" USING btree ("course_page_id","status");--> statement-breakpoint
CREATE INDEX "idx_exam_questions_course" ON "exam_questions" USING btree ("course_page_id","status");--> statement-breakpoint
CREATE INDEX "idx_moderation_course" ON "moderation_actions" USING btree ("course_page_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_question_occurrences_question" ON "question_occurrences" USING btree ("question_id","occurred_on");--> statement-breakpoint
CREATE INDEX "idx_template_subtopics_order" ON "template_subtopics" USING btree ("template_topic_id","position");--> statement-breakpoint
CREATE INDEX "idx_template_topics_order" ON "template_topics" USING btree ("template_id","position");--> statement-breakpoint

-- Preserve the existing canonical curriculum as immutable template version 1.
-- IDs are intentionally reused across table namespaces to make provenance
-- auditable. This is additive only: no legacy rows or coverage answers change.
INSERT INTO "curriculum_templates" (
  "id",
  "template_key",
  "version",
  "name",
  "description",
  "year",
  "source_subject_id"
)
SELECT
  "id",
  "slug",
  1,
  "name",
  "description",
  "year",
  "id"
FROM "subjects"
ON CONFLICT ("template_key", "version") DO NOTHING;--> statement-breakpoint

INSERT INTO "template_topics" (
  "id",
  "template_id",
  "stable_key",
  "slug",
  "name",
  "description",
  "position",
  "source_topic_id"
)
SELECT
  topic."id",
  template."id",
  topic."slug",
  topic."slug",
  topic."name",
  topic."description",
  topic."position",
  topic."id"
FROM "topics" topic
INNER JOIN "curriculum_templates" template
  ON template."source_subject_id" = topic."subject_id"
  AND template."version" = 1
ON CONFLICT ("template_id", "stable_key") DO NOTHING;--> statement-breakpoint

INSERT INTO "template_subtopics" (
  "id",
  "template_topic_id",
  "stable_key",
  "slug",
  "name",
  "description",
  "depth_level",
  "est_hours",
  "position",
  "source_subtopic_id"
)
SELECT
  subtopic."id",
  template_topic."id",
  subtopic."slug",
  subtopic."slug",
  subtopic."name",
  subtopic."description",
  subtopic."depth_level",
  subtopic."est_hours",
  subtopic."position",
  subtopic."id"
FROM "subtopics" subtopic
INNER JOIN "template_topics" template_topic
  ON template_topic."source_topic_id" = subtopic."topic_id"
ON CONFLICT ("template_topic_id", "stable_key") DO NOTHING;--> statement-breakpoint

INSERT INTO "template_subtopic_prerequisites" (
  "subtopic_id",
  "prerequisite_id"
)
SELECT
  source_template."id",
  prerequisite_template."id"
FROM "subtopic_prerequisites" edge
INNER JOIN "template_subtopics" source_template
  ON source_template."source_subtopic_id" = edge."subtopic_id"
INNER JOIN "template_subtopics" prerequisite_template
  ON prerequisite_template."source_subtopic_id" = edge."prerequisite_id"
ON CONFLICT DO NOTHING;
