export interface CatalogProgressState {
  checkpoint: {
    sourceIndex?: number;
    pageIndex?: number;
    cursor?: string;
    processedSourceIds?: string[];
  };
  pagesInspected: number;
  unitsFound: number;
  programmesFound: number;
  coursesFound: number;
  warnings: string[];
}

export function advanceCatalogProgress(
  state: CatalogProgressState,
  sourceId: string,
  progress: {
    units: number;
    programmes: number;
    courses: number;
    warnings?: string[];
  },
) {
  const processedSourceIds = state.checkpoint.processedSourceIds ?? [];
  if (processedSourceIds.includes(sourceId)) return { applied: false, state };
  return {
    applied: true,
    state: {
      checkpoint: {
        ...state.checkpoint,
        sourceIndex: processedSourceIds.length + 1,
        processedSourceIds: [...processedSourceIds, sourceId],
      },
      pagesInspected: state.pagesInspected + 1,
      unitsFound: state.unitsFound + progress.units,
      programmesFound: state.programmesFound + progress.programmes,
      coursesFound: state.coursesFound + progress.courses,
      warnings: [
        ...new Set([
          ...state.warnings,
          ...(progress.warnings ?? []).map((warning) => warning.slice(0, 500)),
        ]),
      ].slice(-100),
    },
  };
}

export function catalogMetadataChanges(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
) {
  if (!previous) return [];
  const reviewableFields = [
    "courseCode",
    "canonicalSourceName",
    "localDisplayName",
    "credits",
    "languageCodes",
    "department",
    "degreeProgramme",
    "academicYear",
    "semester",
    "professorName",
    "campus",
    "officialUrl",
  ];
  return reviewableFields.flatMap((field) => {
    const before = previous[field] ?? null;
    const after = current[field] ?? null;
    return JSON.stringify(before) === JSON.stringify(after)
      ? []
      : [{ field, before, after }];
  });
}
