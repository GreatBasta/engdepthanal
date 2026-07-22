/**
 * Grade scales and normalization to a 0–100 scale (STRUCTURE.md §5.3) so
 * grades from different countries/institutions can be compared. Each scale
 * knows how to render its input and how to map a raw value to 0–100.
 *
 * The `grade_scales` table exists for future per-institution overrides;
 * these code definitions are the default source of truth.
 */

export type GradeScaleId =
  | "percent"
  | "0-20"
  | "0-100"
  | "gpa-4"
  | "de-1-5"
  | "ects-letter";

type NumericScale = {
  kind: "numeric";
  label: string;
  min: number;
  max: number;
  step: number;
  /** Map a raw numeric value to 0–100. */
  normalize: (v: number) => number;
};

type LetterScale = {
  kind: "letter";
  label: string;
  /** Ordered options, each with its 0–100 equivalent. */
  options: { value: string; normalized: number }[];
};

export type GradeScale = NumericScale | LetterScale;

export const GRADE_SCALES: Record<GradeScaleId, GradeScale> = {
  percent: {
    kind: "numeric",
    label: "Percentage (0–100%)",
    min: 0,
    max: 100,
    step: 0.5,
    normalize: (v) => v,
  },
  "0-100": {
    kind: "numeric",
    label: "Points (0–100)",
    min: 0,
    max: 100,
    step: 0.5,
    normalize: (v) => v,
  },
  "0-20": {
    kind: "numeric",
    label: "0–20 (France, Iran, Italy…)",
    min: 0,
    max: 20,
    step: 0.25,
    normalize: (v) => (v / 20) * 100,
  },
  "gpa-4": {
    kind: "numeric",
    label: "GPA (0–4.0)",
    min: 0,
    max: 4,
    step: 0.1,
    normalize: (v) => (v / 4) * 100,
  },
  "de-1-5": {
    kind: "numeric",
    // German scale: 1.0 best, 4.0 pass, 5.0 fail.
    label: "German (1.0 best – 5.0)",
    min: 1,
    max: 5,
    step: 0.1,
    normalize: (v) => ((5 - v) / 4) * 100,
  },
  "ects-letter": {
    kind: "letter",
    label: "ECTS letter (A–F)",
    options: [
      { value: "A", normalized: 95 },
      { value: "B", normalized: 85 },
      { value: "C", normalized: 75 },
      { value: "D", normalized: 65 },
      { value: "E", normalized: 55 },
      { value: "F", normalized: 0 },
    ],
  },
};

export interface NormalizedGrade {
  scale: GradeScaleId;
  rawValue: string;
  normalized: number;
}

/**
 * Validate a raw grade against its scale and compute the 0–100 value.
 * Returns null when the input is out of range or malformed.
 */
export function normalizeGrade(
  scaleId: string,
  rawValue: string,
): NormalizedGrade | null {
  if (!(scaleId in GRADE_SCALES)) return null;
  const scale = GRADE_SCALES[scaleId as GradeScaleId];

  if (scale.kind === "letter") {
    const opt = scale.options.find((o) => o.value === rawValue);
    if (!opt) return null;
    return {
      scale: scaleId as GradeScaleId,
      rawValue: opt.value,
      normalized: opt.normalized,
    };
  }

  const v = Number(rawValue);
  if (!Number.isFinite(v) || v < scale.min || v > scale.max) return null;
  const normalized = Math.max(0, Math.min(100, scale.normalize(v)));
  return {
    scale: scaleId as GradeScaleId,
    rawValue: String(v),
    normalized: Math.round(normalized * 100) / 100,
  };
}
