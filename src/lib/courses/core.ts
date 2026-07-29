const NON_SLUG = /[^a-z0-9]+/g;
const EDGE_DASHES = /^-+|-+$/g;
const WHITESPACE = /\s+/g;

export function normalizeCourseText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(WHITESPACE, " ");
}

export function courseDuplicateKey(input: {
  localName: string;
  courseCode?: string | null;
  professorName?: string | null;
  academicYear: string;
  semester?: number | null;
}): string {
  return [
    normalizeCourseText(input.localName),
    normalizeCourseText(input.courseCode),
    normalizeCourseText(input.professorName),
    normalizeCourseText(input.academicYear),
    input.semester?.toString() ?? "",
  ].join("|");
}

export function slugifyCourse(value: string): string {
  const normalized = normalizeCourseText(value)
    .replace(NON_SLUG, "-")
    .replace(EDGE_DASHES, "");
  return normalized.slice(0, 72) || "course";
}

/**
 * Make an identifier unique inside a snapshot while keeping it readable.
 * The Set is deliberately mutated so callers can use it in a single pass.
 */
export function reserveUniqueSlug(candidate: string, used: Set<string>) {
  const base = slugifyCourse(candidate);
  let slug = base;
  let suffix = 2;
  while (used.has(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(slug);
  return slug;
}

