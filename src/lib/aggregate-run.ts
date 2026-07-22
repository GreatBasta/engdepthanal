import { recomputeAllAggregates } from "./aggregate";

/**
 * The "nightly job" entry point (STRUCTURE.md §6). Recomputes coverage
 * aggregates for every university-program × subject with finished students.
 * Schedule this in production (cron / Inngest); run ad hoc with:
 *
 *   npm run aggregate
 */
async function main() {
  const start = Date.now();
  const pairs = await recomputeAllAggregates();
  console.log(
    `Recomputed aggregates for ${pairs} university-program × subject ` +
      `pair(s) in ${Date.now() - start}ms`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
