import {
  char,
  check,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
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

// ---------------------------------------------------------------------------
// Reference data: universities and programs
// ---------------------------------------------------------------------------

export const universities = pgTable(
  "universities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull(),
    city: text("city"),
    status: verificationStatus("status").notNull().default("unverified"),
    addedBy: uuid("added_by"), // student who added it, if any
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.name, t.countryCode)],
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
  (t) => [unique().on(t.universityId, t.programId)],
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique().on(t.studentId, t.universityProgramId, t.intakeYear),
    index("idx_enrollments_student").on(t.studentId),
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
