/** Exact-scope check used before any batch update reaches curriculum rows. */
export function hasExactCurriculumChangeScope(
  requestedStableIds: readonly string[],
  allowedStableIds: readonly string[],
): boolean {
  if (new Set(requestedStableIds).size !== requestedStableIds.length) {
    return false;
  }
  const allowed = new Set(allowedStableIds);
  return (
    allowed.size === requestedStableIds.length &&
    requestedStableIds.every((stableId) => allowed.has(stableId))
  );
}
