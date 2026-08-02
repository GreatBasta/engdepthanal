import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Drizzle port of db/schema.sql — see STRUCTURE.md for the full design.
 * Two halves: the CANONICAL CURRICULUM (subjects → topics → subtopics,
 * versioned editorial content) and OBSERVED COVERAGE (what finished
 * students report their university actually taught).
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** How deep a subtopic must be learned (see STRUCTURE.md §4.2). */
export const depthLevel = pgEnum("depth_level", [
  "awareness",
  "procedural",
  "fluency",
  "proof",
]);

/** Onboarding answer: starting first year, or actively attending it. */
export const enrollmentPhase = pgEnum("enrollment_phase", [
  "starting",
  "attending",
]);

export const subjectStatus = pgEnum("subject_status", [
  "not_started",
  "in_progress",
  "finished",
]);

export const progressState = pgEnum("progress_state", [
  "not_started",
  "in_progress",
  "done",
]);

/** Survey answer to "Have you studied: {subtopic}?" */
export const coverageAnswer = pgEnum("coverage_answer", [
  "yes_depth",
  "yes_brief",
  "no",
  "unsure",
]);

/**
 * Why a student hasn't studied a subtopic. Crucial distinction: only
 * `not_covered` is a real university gap — `not_reached` (still to come) and
 * `skipped` (taught, but they haven't done it) must never count against the
 * university, so both map to the `unsure` answer that aggregation excludes.
 */
export const notStudiedReason = pgEnum("not_studied_reason", [
  "not_covered",
  "not_reached",
  "skipped",
]);

export const coverageVerdict = pgEnum("coverage_verdict", [
  "taught",
  "partially_taught",
  "not_taught",
  "insufficient_data",
]);

export const verificationStatus = pgEnum("verification_status", [
  "unverified",
  "verified",
  "rejected",
]);

/** Visibility is enforced in every server-side course lookup. */
export const courseVisibility = pgEnum("course_visibility", [
  "public",
  "unlisted",
  "private",
]);

export const courseMemberRole = pgEnum("course_member_role", [
  "owner",
  "editor",
  "contributor",
  "viewer",
  "coowner",
  "visitor",
]);

export const coownershipRequestStatus = pgEnum(
  "coownership_request_status",
  ["pending", "accepted", "rejected", "cancelled"],
);

export const organizationRequestStatus = pgEnum(
  "organization_request_status",
  ["pending", "matched", "approved", "rejected"],
);

/**
 * Kept separate from authorization roles so future states such as
 * `auditing` can be added without redesigning permissions.
 */
export const courseAttendance = pgEnum("course_attendance", [
  "attended",
  "not_attended",
]);

export const curriculumVersionStatus = pgEnum(
  "curriculum_version_status",
  ["draft", "published", "archived"],
);

export const courseCoverageState = pgEnum("course_coverage_state", [
  "unknown",
  "covered",
  "not_covered",
]);

export const courseProgressState = pgEnum("course_progress_state", [
  "not_started",
  "learning",
  "completed",
  "saved",
]);

export const courseContentProvenance = pgEnum(
  "course_content_provenance",
  ["template", "course"],
);

export const courseInviteStatus = pgEnum("course_invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const coursePostKind = pgEnum("course_post_kind", [
  "discussion",
  "resource",
  "announcement",
]);

export const courseReactionKind = pgEnum("course_reaction_kind", [
  "like",
  "helpful",
  "insightful",
]);

export const courseResourceType = pgEnum("course_resource_type", [
  "text_note",
  "link",
  "image",
  "pdf",
  "short_comment",
  "study_tip",
  "correction",
  "personal_notes",
  "permitted_material",
]);

export const courseResourceContext = pgEnum("course_resource_context", [
  "course",
  "topic",
  "subtopic",
  "exam",
]);

export const attachmentAccess = pgEnum("attachment_access", [
  "public",
  "course",
]);

export const contentTargetType = pgEnum("content_target_type", [
  "post",
  "reply",
  "course_resource",
  "resource_comment",
  "attachment",
  "exam_experience",
  "exam_question",
  "question_occurrence",
]);

export const contentReportStatus = pgEnum("content_report_status", [
  "open",
  "reviewed",
  "dismissed",
  "actioned",
]);

export const moderationActionType = pgEnum("moderation_action_type", [
  "hide",
  "restore",
  "lock",
  "unlock",
  "remove_member",
  "resolve_report",
]);

export const examAssessmentType = pgEnum("exam_assessment_type", [
  "written",
  "oral",
  "practical",
  "project",
  "mixed",
]);

export const examQuestionStatus = pgEnum("exam_question_status", [
  "active",
  "merged",
  "hidden",
]);

export const examMergeRequestStatus = pgEnum(
  "exam_merge_request_status",
  ["open", "accepted", "rejected"],
);

// ---------------------------------------------------------------------------
// Reference data: universities and programs
// ---------------------------------------------------------------------------

export const universities = pgTable(
  "universities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    rorId: text("ror_id"),
    canonicalName: text("canonical_name"),
    displayName: text("display_name"),
    normalizedName: text("normalized_name"),
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
    acronyms: jsonb("acronyms").$type<string[]>().notNull().default([]),
    organizationType: text("organization_type"),
    countryCode: char("country_code", { length: 2 }).notNull(),
    countryName: text("country_name"),
    city: text("city"),
    region: text("region"),
    domains: jsonb("domains").$type<string[]>().notNull().default([]),
    primaryDomain: text("primary_domain"),
    websiteUrl: text("website_url"),
    externalSource: text("external_source"),
    externalUpdatedAt: timestamp("external_updated_at", { withTimezone: true }),
    status: verificationStatus("status").notNull().default("unverified"),
    addedBy: uuid("added_by"), // student who added it, if any
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.name, t.countryCode),
    uniqueIndex("uq_universities_ror_id")
      .on(t.rorId)
      .where(sql`${t.rorId} is not null`),
    index("idx_universities_normalized_name").on(t.normalizedName),
    index("idx_universities_country").on(t.countryCode),
    index("idx_universities_type").on(t.organizationType),
    index("idx_universities_domain").on(t.primaryDomain),
  ],
);

/** Engineering disciplines: mechanical, electrical, civil, computer, ... */
export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: verificationStatus("status").notNull().default("verified"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A university offering a program ("the course" a student names at signup). */
export const universityPrograms = pgTable(
  "university_programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    universityId: uuid("university_id")
      .notNull()
      .references(() => universities.id),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id),
    localName: text("local_name"), // the uni's own name for the course
    status: verificationStatus("status").notNull().default("unverified"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.universityId, t.programId),
    index("idx_university_programs_organization").on(t.universityId),
  ],
);

// ---------------------------------------------------------------------------
// Canonical curriculum: subject -> topic -> subtopic
// ---------------------------------------------------------------------------

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // 'calculus-1'
  name: text("name").notNull(), // 'Calculus I'
  description: text("description"),
  year: smallint("year").notNull().default(1),
  position: smallint("position").notNull(),
  /** Gate: aggregates hidden until this many finished students respond. */
  minSampleSize: smallint("min_sample_size").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    position: smallint("position").notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }), // soft delete
  },
  (t) => [
    unique().on(t.subjectId, t.slug),
    index("idx_topics_subject").on(t.subjectId, t.position),
  ],
);

export const subtopics = pgTable(
  "subtopics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id),
    /** Stable id — survey answers survive renames/reorders. */
    slug: text("slug").notNull(),
    /** Phrased so "Have you studied: {name}?" reads naturally. */
    name: text("name").notNull(),
    description: text("description"),
    depthLevel: depthLevel("depth_level").notNull(),
    estHours: numeric("est_hours", { precision: 4, scale: 1 }),
    position: smallint("position").notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (t) => [
    unique().on(t.topicId, t.slug),
    index("idx_subtopics_topic").on(t.topicId, t.position),
  ],
);

/** Prerequisite DAG between subtopics (may cross topics/subjects). */
export const subtopicPrerequisites = pgTable(
  "subtopic_prerequisites",
  {
    subtopicId: uuid("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    prerequisiteId: uuid("prerequisite_id")
      .notNull()
      .references(() => subtopics.id),
  },
  (t) => [
    primaryKey({ columns: [t.subtopicId, t.prerequisiteId] }),
    check("no_self_prereq", sql`${t.subtopicId} <> ${t.prerequisiteId}`),
  ],
);

/** "My course also covered X" free-text from surveys, for editorial review. */
export const curriculumSuggestions = pgTable("curriculum_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectId: uuid("subject_id")
    .notNull()
    .references(() => subjects.id),
  topicId: uuid("topic_id").references(() => topics.id),
  studentId: uuid("student_id").notNull(),
  body: text("body").notNull(),
  status: verificationStatus("status").notNull().default("unverified"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Students and enrollment
// ---------------------------------------------------------------------------

export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"), // null when OAuth-only
  adminRole: boolean("admin_role").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  preferredLocale: text("preferred_locale").notNull().default("en"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Student-submitted institution lookups and possible ROR matches for review. */
export const organizationRequests = pgTable(
  "organization_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    requestedName: text("requested_name").notNull(),
    countryCode: char("country_code", { length: 2 }),
    city: text("city"),
    websiteUrl: text("website_url"),
    localOrganizationId: uuid("local_organization_id").references(
      () => universities.id,
    ),
    candidateRorId: text("candidate_ror_id"),
    status: organizationRequestStatus("status").notNull().default("pending"),
    reviewedBy: uuid("reviewed_by").references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_organization_requests_queue").on(t.status, t.createdAt),
    index("idx_organization_requests_student").on(t.studentId, t.status),
  ],
);

/** Short-lived hashed rate-limit buckets; never stores raw email or IP. */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    action: text("action").notNull(),
    keyHash: text("key_hash").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.action, t.keyHash, t.windowStart] }),
    index("idx_rate_limit_window").on(t.windowStart),
  ],
);

/** Student × university × program × intake year. Unlocks the first-year DB. */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    universityProgramId: uuid("university_program_id")
      .notNull()
      .references(() => universityPrograms.id),
    intakeYear: smallint("intake_year").notNull(), // cohort; curricula change
    phase: enrollmentPhase("phase").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.studentId, t.universityProgramId, t.intakeYear),
    index("idx_enrollments_student").on(t.studentId),
    uniqueIndex("uq_enrollments_one_primary")
      .on(t.studentId)
      .where(sql`${t.isPrimary} = true`),
  ],
);

/** Per-subject state. Grade is captured when status becomes 'finished'. */
export const subjectEnrollments = pgTable(
  "subject_enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    status: subjectStatus("status").notNull().default("not_started"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    gradeValue: text("grade_value"), // raw, as the student states it
    gradeScale: text("grade_scale"), // '0-20', 'gpa-4', 'percent', ...
    gradeNormalized: numeric("grade_normalized", { precision: 5, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.enrollmentId, t.subjectId),
    index("idx_subj_enroll_status").on(t.subjectId, t.status),
    check(
      "finished_has_date",
      sql`${t.status} <> 'finished' or ${t.finishedAt} is not null`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Progress tracking (actively attending students)
// ---------------------------------------------------------------------------

export const subtopicProgress = pgTable(
  "subtopic_progress",
  {
    subjectEnrollmentId: uuid("subject_enrollment_id")
      .notNull()
      .references(() => subjectEnrollments.id),
    subtopicId: uuid("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    state: progressState("state").notNull().default("not_started"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.subjectEnrollmentId, t.subtopicId] })],
);

// ---------------------------------------------------------------------------
// Coverage survey (finished students only — enforced in the app layer and by
// the assert_subject_finished trigger added in the RLS/triggers migration)
// ---------------------------------------------------------------------------

export const coverageResponses = pgTable(
  "coverage_responses",
  {
    subjectEnrollmentId: uuid("subject_enrollment_id")
      .notNull()
      .references(() => subjectEnrollments.id),
    subtopicId: uuid("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    answer: coverageAnswer("answer").notNull(),
    /** 1–5, how hard the student found it (swipe deck only). */
    difficulty: smallint("difficulty"),
    /** The depth the student actually reached (vs the curriculum target). */
    studiedDepth: depthLevel("studied_depth"),
    /** Set when the student hasn't studied it; distinguishes a real gap. */
    notStudiedReason: notStudiedReason("not_studied_reason"),
    answeredAt: timestamp("answered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.subjectEnrollmentId, t.subtopicId] }),
    index("idx_responses_subtopic").on(t.subtopicId),
  ],
);

/**
 * Per-subtopic notes students leave for each other ("our lecturer skipped
 * the proof"). Scoped to a university-program so a student reads advice from
 * their own course, not a different university's.
 */
export const subtopicComments = pgTable(
  "subtopic_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subtopicId: uuid("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    universityProgramId: uuid("university_program_id")
      .notNull()
      .references(() => universityPrograms.id),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_comments_subtopic").on(t.subtopicId, t.universityProgramId)],
);

/** A student's saved/starred subtopics — the seed of their study roadmap. */
export const subtopicStars = pgTable(
  "subtopic_stars",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    subtopicId: uuid("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.studentId, t.subtopicId] })],
);

// ---------------------------------------------------------------------------
// Aggregates (rebuilt by the rollup job; powers the gap analysis)
// ---------------------------------------------------------------------------

export const coverageAggregates = pgTable(
  "coverage_aggregates",
  {
    universityProgramId: uuid("university_program_id")
      .notNull()
      .references(() => universityPrograms.id),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id),
    subtopicId: uuid("subtopic_id")
      .notNull()
      .references(() => subtopics.id),
    n: integer("n").notNull(), // finished respondents
    pctCovered: numeric("pct_covered", { precision: 5, scale: 2 }).notNull(), // weighted: depth=1, brief=0.5
    pctInDepth: numeric("pct_in_depth", { precision: 5, scale: 2 }).notNull(), // yes_depth only
    avgGradeNormalized: numeric("avg_grade_normalized", {
      precision: 5,
      scale: 2,
    }),
    verdict: coverageVerdict("verdict").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.universityProgramId, t.subjectId, t.subtopicId],
    }),
    index("idx_aggregates_gaps")
      .on(t.universityProgramId, t.subjectId)
      .where(sql`verdict = 'not_taught'`),
  ],
);

// ---------------------------------------------------------------------------
// Grade scale conversion (raw -> 0-100)
// ---------------------------------------------------------------------------

export const gradeScales = pgTable(
  "grade_scales",
  {
    scale: text("scale").notNull(), // 'gpa-4', '0-20', 'de-1-5', ...
    rawValue: text("raw_value").notNull(), // '3.7', '17', '1.3', 'B'
    normalized: numeric("normalized", { precision: 5, scale: 2 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.scale, t.rawValue] })],
);

// ---------------------------------------------------------------------------
// Immutable curriculum templates
// ---------------------------------------------------------------------------

/**
 * A row is one immutable template version. `templateKey` is the stable family
 * identifier; publishing an editorial update creates version N+1 instead of
 * mutating a version already cloned into a course.
 */
export const curriculumTemplates = pgTable(
  "curriculum_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateKey: text("template_key").notNull(),
    version: integer("version").notNull().default(1),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category").notNull().default("engineering-core"),
    disciplineTags: jsonb("discipline_tags")
      .$type<string[]>()
      .notNull()
      .default([]),
    recommendedDegreePrograms: jsonb("recommended_degree_programs")
      .$type<string[]>()
      .notNull()
      .default([]),
    typicalYear: smallint("typical_year").notNull().default(1),
    typicalSemester: smallint("typical_semester").notNull().default(1),
    sourceReferences: jsonb("source_references")
      .$type<
        Array<{
          title: string;
          organization: string;
          url: string;
          accessedAt: string;
          note?: string;
        }>
      >()
      .notNull()
      .default([]),
    year: smallint("year").notNull().default(1),
    sourceSubjectId: uuid("source_subject_id").references(() => subjects.id),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("uq_template_key_version").on(t.templateKey, t.version),
    index("idx_templates_active").on(t.isActive, t.year),
  ],
);

export const templateTopics = pgTable(
  "template_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => curriculumTemplates.id),
    stableKey: text("stable_key").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    sourceTopicId: uuid("source_topic_id").references(() => topics.id),
  },
  (t) => [
    unique("uq_template_topic_key").on(t.templateId, t.stableKey),
    unique("uq_template_topic_slug").on(t.templateId, t.slug),
    index("idx_template_topics_order").on(t.templateId, t.position),
  ],
);

export const templateSubtopics = pgTable(
  "template_subtopics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateTopicId: uuid("template_topic_id")
      .notNull()
      .references(() => templateTopics.id),
    stableKey: text("stable_key").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    depthLevel: depthLevel("depth_level").notNull(),
    estHours: numeric("est_hours", { precision: 4, scale: 1 }),
    optional: boolean("optional").notNull().default(false),
    position: integer("position").notNull(),
    sourceSubtopicId: uuid("source_subtopic_id").references(
      () => subtopics.id,
    ),
  },
  (t) => [
    unique("uq_template_subtopic_key").on(t.templateTopicId, t.stableKey),
    unique("uq_template_subtopic_slug").on(t.templateTopicId, t.slug),
    index("idx_template_subtopics_order").on(t.templateTopicId, t.position),
  ],
);

export const templateSubtopicPrerequisites = pgTable(
  "template_subtopic_prerequisites",
  {
    subtopicId: uuid("subtopic_id")
      .notNull()
      .references(() => templateSubtopics.id),
    prerequisiteId: uuid("prerequisite_id")
      .notNull()
      .references(() => templateSubtopics.id),
  },
  (t) => [
    primaryKey({ columns: [t.subtopicId, t.prerequisiteId] }),
    check(
      "template_no_self_prereq",
      sql`${t.subtopicId} <> ${t.prerequisiteId}`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Editable university course pages and versioned curriculum snapshots
// ---------------------------------------------------------------------------

export const coursePages = pgTable(
  "course_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    universityProgramId: uuid("university_program_id")
      .notNull()
      .references(() => universityPrograms.id),
    localName: text("local_name").notNull(),
    courseCode: text("course_code"),
    professorName: text("professor_name"),
    academicYear: text("academic_year").notNull(),
    cohortYear: smallint("cohort_year"),
    semester: smallint("semester"),
    description: text("description"),
    visibility: courseVisibility("visibility").notNull().default("private"),
    /** Normalized metadata used to surface likely duplicates, never auto-merge. */
    duplicateKey: text("duplicate_key").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_course_pages_directory").on(
      t.visibility,
      t.universityProgramId,
      t.academicYear,
      t.semester,
    ),
    index("idx_course_pages_duplicate").on(
      t.universityProgramId,
      t.duplicateKey,
    ),
    check(
      "course_semester_range",
      sql`${t.semester} is null or (${t.semester} >= 1 and ${t.semester} <= 12)`,
    ),
  ],
);

/** Records every immutable source template included in the course snapshot. */
export const coursePageTemplates = pgTable(
  "course_page_templates",
  {
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    templateId: uuid("template_id")
      .notNull()
      .references(() => curriculumTemplates.id),
    position: integer("position").notNull(),
    addedBy: uuid("added_by")
      .notNull()
      .references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.coursePageId, t.templateId] }),
    unique("uq_course_template_position").on(t.coursePageId, t.position),
  ],
);

export const courseMembers = pgTable(
  "course_members",
  {
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    role: courseMemberRole("role").notNull().default("visitor"),
    attendance: courseAttendance("attendance")
      .notNull()
      .default("not_attended"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.coursePageId, t.studentId] }),
    index("idx_course_members_student").on(t.studentId, t.role),
  ],
);

export const courseInvites = pgTable(
  "course_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    email: text("email").notNull(),
    role: courseMemberRole("role").notNull().default("visitor"),
    attendance: courseAttendance("attendance")
      .notNull()
      .default("not_attended"),
    tokenHash: text("token_hash").notNull().unique(),
    status: courseInviteStatus("status").notNull().default("pending"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => students.id),
    acceptedBy: uuid("accepted_by").references(() => students.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_course_invites_email").on(t.email, t.status),
    index("idx_course_invites_course").on(t.coursePageId, t.status),
  ],
);

/** Visitor-initiated requests which only the original owner may decide. */
export const courseCoownershipRequests = pgTable(
  "course_coownership_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => students.id),
    message: text("message"),
    status: coownershipRequestStatus("status").notNull().default("pending"),
    reviewerId: uuid("reviewer_id").references(() => students.id),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_course_coownership_pending")
      .on(t.coursePageId, t.requesterId)
      .where(sql`${t.status} = 'pending'`),
    index("idx_course_coownership_owner_queue").on(
      t.coursePageId,
      t.status,
      t.requestedAt,
    ),
    index("idx_course_coownership_requester").on(t.requesterId, t.status),
  ],
);

export const courseCurriculumVersions = pgTable(
  "course_curriculum_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    version: integer("version").notNull(),
    status: curriculumVersionStatus("status").notNull().default("draft"),
    basedOnVersionId: uuid("based_on_version_id"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [
    unique("uq_course_curriculum_version").on(t.coursePageId, t.version),
    uniqueIndex("uq_course_one_draft")
      .on(t.coursePageId)
      .where(sql`${t.status} = 'draft'`),
    uniqueIndex("uq_course_one_published")
      .on(t.coursePageId)
      .where(sql`${t.status} = 'published'`),
  ],
);

export const courseTopics = pgTable(
  "course_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    curriculumVersionId: uuid("curriculum_version_id")
      .notNull()
      .references(() => courseCurriculumVersions.id),
    /** Stable across course revisions; the row id itself is revision-local. */
    stableId: uuid("stable_id").notNull().defaultRandom(),
    sourceTemplateTopicId: uuid("source_template_topic_id").references(
      () => templateTopics.id,
    ),
    provenance: courseContentProvenance("provenance")
      .notNull()
      .default("course"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    position: integer("position").notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  },
  (t) => [
    unique("uq_course_topic_stable").on(t.curriculumVersionId, t.stableId),
    unique("uq_course_topic_slug").on(t.curriculumVersionId, t.slug),
    index("idx_course_topics_order").on(
      t.curriculumVersionId,
      t.position,
    ),
  ],
);

export const courseSubtopics = pgTable(
  "course_subtopics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseTopicId: uuid("course_topic_id")
      .notNull()
      .references(() => courseTopics.id),
    stableId: uuid("stable_id").notNull().defaultRandom(),
    sourceTemplateSubtopicId: uuid("source_template_subtopic_id").references(
      () => templateSubtopics.id,
    ),
    provenance: courseContentProvenance("provenance")
      .notNull()
      .default("course"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    depthLevel: depthLevel("depth_level").notNull().default("procedural"),
    estHours: numeric("est_hours", { precision: 4, scale: 1 }),
    position: integer("position").notNull(),
    coverage: courseCoverageState("coverage").notNull().default("unknown"),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  },
  (t) => [
    unique("uq_course_subtopic_stable").on(t.courseTopicId, t.stableId),
    unique("uq_course_subtopic_slug").on(t.courseTopicId, t.slug),
    index("idx_course_subtopics_order").on(t.courseTopicId, t.position),
  ],
);

export const courseSubtopicPrerequisites = pgTable(
  "course_subtopic_prerequisites",
  {
    subtopicId: uuid("subtopic_id")
      .notNull()
      .references(() => courseSubtopics.id),
    prerequisiteId: uuid("prerequisite_id")
      .notNull()
      .references(() => courseSubtopics.id),
  },
  (t) => [
    primaryKey({ columns: [t.subtopicId, t.prerequisiteId] }),
    check(
      "course_no_self_prereq",
      sql`${t.subtopicId} <> ${t.prerequisiteId}`,
    ),
  ],
);

/** Private, per-member progress. Course coverage remains editorial data. */
export const courseSubtopicProgress = pgTable(
  "course_subtopic_progress",
  {
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    courseSubtopicStableId: uuid("course_subtopic_stable_id").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    state: courseProgressState("state").notNull().default("not_started"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [
        t.coursePageId,
        t.courseSubtopicStableId,
        t.studentId,
      ],
    }),
    index("idx_course_progress_student").on(t.studentId, t.coursePageId),
  ],
);

// ---------------------------------------------------------------------------
// Course community, uploads, reporting, and moderation
// ---------------------------------------------------------------------------

export const coursePosts = pgTable(
  "course_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => students.id),
    kind: coursePostKind("kind").notNull().default("discussion"),
    title: text("title"),
    body: text("body").notNull(),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_course_posts_feed").on(
      t.coursePageId,
      t.pinnedAt,
      t.createdAt,
    ),
  ],
);

export const courseReplies = pgTable(
  "course_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => coursePosts.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => students.id),
    parentReplyId: uuid("parent_reply_id"),
    body: text("body").notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_course_replies_post").on(t.postId, t.createdAt)],
);

export const coursePostReactions = pgTable(
  "course_post_reactions",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => coursePosts.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    kind: courseReactionKind("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.postId, t.studentId, t.kind] })],
);

export const courseReplyReactions = pgTable(
  "course_reply_reactions",
  {
    replyId: uuid("reply_id")
      .notNull()
      .references(() => courseReplies.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    kind: courseReactionKind("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.replyId, t.studentId, t.kind] })],
);

/** Contextual resources replace the generic public community feed. */
export const courseResources = pgTable(
  "course_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => students.id),
    context: courseResourceContext("context").notNull().default("course"),
    courseTopicStableId: uuid("course_topic_stable_id"),
    courseSubtopicStableId: uuid("course_subtopic_stable_id"),
    type: courseResourceType("type").notNull(),
    title: text("title"),
    body: text("body"),
    linkUrl: text("link_url"),
    permissionConfirmed: boolean("permission_confirmed")
      .notNull()
      .default(false),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_course_resources_feed").on(
      t.coursePageId,
      t.context,
      t.createdAt,
    ),
    index("idx_course_resources_subtopic").on(
      t.coursePageId,
      t.courseSubtopicStableId,
      t.createdAt,
    ),
    check(
      "resource_context_target",
      sql`
        (${t.context} = 'course' and ${t.courseTopicStableId} is null and ${t.courseSubtopicStableId} is null)
        or (${t.context} = 'topic' and ${t.courseTopicStableId} is not null and ${t.courseSubtopicStableId} is null)
        or (${t.context} = 'subtopic' and ${t.courseSubtopicStableId} is not null)
        or (${t.context} = 'exam' and ${t.courseTopicStableId} is null and ${t.courseSubtopicStableId} is null)
      `,
    ),
  ],
);

export const courseResourceComments = pgTable(
  "course_resource_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => courseResources.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => students.id),
    body: text("body").notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_resource_comments").on(t.resourceId, t.createdAt)],
);

export const courseResourceReactions = pgTable(
  "course_resource_reactions",
  {
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => courseResources.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    kind: courseReactionKind("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.resourceId, t.studentId, t.kind] }),
  ],
);

/**
 * Binary data lives in Vercel Blob. Only metadata and the opaque private Blob
 * URL are stored in Postgres; downloads always pass through an authorized
 * route instead of exposing credentials.
 */
export const courseAttachments = pgTable(
  "course_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    uploaderId: uuid("uploader_id")
      .notNull()
      .references(() => students.id),
    parentType: contentTargetType("parent_type"),
    parentId: uuid("parent_id"),
    storageKey: text("storage_key").notNull().unique(),
    blobUrl: text("blob_url").notNull().unique(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    access: attachmentAccess("access").notNull().default("course"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_course_attachments_parent").on(t.parentType, t.parentId),
    index("idx_course_attachments_course").on(t.coursePageId, t.createdAt),
    check("attachment_size_positive", sql`${t.sizeBytes} > 0`),
    check(
      "attachment_parent_pair",
      sql`(${t.parentType} is null) = (${t.parentId} is null)`,
    ),
  ],
);

export const contentReports = pgTable(
  "content_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => students.id),
    targetType: contentTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    status: contentReportStatus("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_content_reports_queue").on(
      t.coursePageId,
      t.status,
      t.createdAt,
    ),
    unique("uq_content_reporter_target").on(
      t.reporterId,
      t.targetType,
      t.targetId,
    ),
  ],
);

export const moderationActions = pgTable(
  "moderation_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => students.id),
    targetType: contentTargetType("target_type"),
    targetId: uuid("target_id"),
    action: moderationActionType("action").notNull(),
    reason: text("reason").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_moderation_course").on(t.coursePageId, t.createdAt),
    check(
      "moderation_target_pair",
      sql`(${t.targetType} is null) = (${t.targetId} is null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Exam profile, experiences, materials, question bank, and merge workflow
// ---------------------------------------------------------------------------

export const courseExamProfiles = pgTable("course_exam_profiles", {
  coursePageId: uuid("course_page_id")
    .primaryKey()
    .references(() => coursePages.id),
  assessmentType: examAssessmentType("assessment_type"),
  format: text("format"),
  gradingScale: text("grading_scale"),
  durationMinutes: integer("duration_minutes"),
  openBook: boolean("open_book"),
  calculatorAllowed: boolean("calculator_allowed"),
  details: text("details"),
  lastVerifiedAcademicYear: text("last_verified_academic_year"),
  verificationCount: integer("verification_count").notNull().default(0),
  studentReported: boolean("student_reported").notNull().default(true),
  updatedBy: uuid("updated_by")
    .notNull()
    .references(() => students.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const examExperiences = pgTable(
  "exam_experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    authorId: uuid("author_id")
      .notNull()
      .references(() => students.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    academicYear: text("academic_year"),
    examDate: date("exam_date"),
    grade: text("grade"),
    anonymous: boolean("anonymous").notNull().default(false),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_exam_experiences_course").on(t.coursePageId, t.createdAt),
  ],
);

export const examQuestions = pgTable(
  "exam_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => students.id),
    prompt: text("prompt").notNull(),
    answerGuidance: text("answer_guidance"),
    courseTopicStableId: uuid("course_topic_stable_id"),
    courseSubtopicStableId: uuid("course_subtopic_stable_id"),
    questionType: text("question_type"),
    difficulty: smallint("difficulty"),
    status: examQuestionStatus("status").notNull().default("active"),
    mergedIntoId: uuid("merged_into_id"),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_exam_questions_course").on(t.coursePageId, t.status),
    check(
      "exam_question_difficulty_range",
      sql`${t.difficulty} is null or (${t.difficulty} >= 1 and ${t.difficulty} <= 5)`,
    ),
    check(
      "exam_question_merge_target",
      sql`(${t.status} = 'merged') = (${t.mergedIntoId} is not null)`,
    ),
  ],
);

export const questionOccurrences = pgTable(
  "question_occurrences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => examQuestions.id),
    reportedBy: uuid("reported_by")
      .notNull()
      .references(() => students.id),
    experienceId: uuid("experience_id").references(() => examExperiences.id),
    sessionLabel: text("session_label").notNull(),
    occurredOn: date("occurred_on"),
    notes: text("notes"),
    professorName: text("professor_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("uq_question_occurrence_report").on(
      t.questionId,
      t.reportedBy,
      t.sessionLabel,
    ),
    index("idx_question_occurrences_question").on(t.questionId, t.occurredOn),
  ],
);

export const examQuestionVotes = pgTable(
  "exam_question_votes",
  {
    questionId: uuid("question_id")
      .notNull()
      .references(() => examQuestions.id),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id),
    value: smallint("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.questionId, t.studentId] }),
    check("exam_vote_value", sql`${t.value} in (-1, 1)`),
  ],
);

export const examMergeRequests = pgTable(
  "exam_merge_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    sourceQuestionId: uuid("source_question_id")
      .notNull()
      .references(() => examQuestions.id),
    targetQuestionId: uuid("target_question_id")
      .notNull()
      .references(() => examQuestions.id),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => students.id),
    rationale: text("rationale").notNull(),
    status: examMergeRequestStatus("status").notNull().default("open"),
    reviewedBy: uuid("reviewed_by").references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [
    unique("uq_exam_merge_pair").on(
      t.sourceQuestionId,
      t.targetQuestionId,
      t.status,
    ),
    index("idx_exam_merge_queue").on(t.coursePageId, t.status),
    check(
      "exam_merge_distinct_questions",
      sql`${t.sourceQuestionId} <> ${t.targetQuestionId}`,
    ),
  ],
);

export const courseExamMaterials = pgTable(
  "course_exam_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coursePageId: uuid("course_page_id")
      .notNull()
      .references(() => coursePages.id),
    attachmentId: uuid("attachment_id")
      .notNull()
      .references(() => courseAttachments.id)
      .unique(),
    title: text("title").notNull(),
    description: text("description"),
    permissionConfirmed: boolean("permission_confirmed")
      .notNull()
      .default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => students.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_exam_materials_course").on(t.coursePageId, t.createdAt)],
);
