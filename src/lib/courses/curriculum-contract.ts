export type CourseCoverage = "unknown" | "covered" | "not_covered";
export type CourseDepth = "awareness" | "procedural" | "fluency" | "proof";
export type CourseProgress = "not_started" | "learning" | "completed" | "saved";

export interface CurriculumTopicSummary {
  id: string;
  stableId: string;
  name: string;
  description: string | null;
  position: number;
  provenance: "template" | "course";
  hidden: boolean;
  subtopicCount: number;
  classifiedCount: number;
  coveredCount: number;
  notCoveredCount: number;
}

export interface CurriculumSubtopicItem {
  id: string;
  stableId: string;
  name: string;
  description: string | null;
  depthLevel: CourseDepth;
  estHours: string | null;
  position: number;
  provenance: "template" | "course";
  coverage: CourseCoverage;
  hidden: boolean;
  progress: CourseProgress | null;
}

export interface CurriculumTopicPayload {
  topic: CurriculumTopicSummary;
  subtopics: CurriculumSubtopicItem[];
}

export interface CurriculumCoverageChange {
  subtopicStableId: string;
  coverage: CourseCoverage;
}

export interface CurriculumApplyResult {
  ok: boolean;
  code?: "invalid" | "forbidden" | "cross_course" | "failed";
  message: string;
  updatedAt?: string;
}
