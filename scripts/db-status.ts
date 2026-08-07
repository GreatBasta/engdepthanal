import { closeDb } from "../src/lib/db/client";
import {
  expectedMigrations,
  outOfOrderMigrations,
  readMigrationStatus,
} from "../src/lib/db/migration-status";

/**
 * Report whether the database has every migration this checkout expects.
 *
 * Run it before promoting a deploy (is the schema ready for the new code?)
 * and after migrating (did everything land?). Exits non-zero when migrations
 * are pending so it can gate a release step.
 */
async function main() {
  const status = await readMigrationStatus();

  console.log(
    `applied ${status.applied.length}/${status.expected.length} migrations`,
  );

  const backdated = outOfOrderMigrations(expectedMigrations());
  if (backdated.length) {
    console.warn(
      `\nwarning: these migrations are not in timestamp order, and the ` +
        `migrator's high-water mark can skip them without an error:\n` +
        backdated.map((tag) => `  ! ${tag}`).join("\n"),
    );
  }

  if (status.upToDate) {
    console.log("database is up to date");
    return;
  }

  console.error(
    `\n${status.pending.length} migration(s) pending:\n` +
      status.pending.map((tag) => `  - ${tag}`).join("\n") +
      `\n\nRun \`npm run db:migrate\` against this database before serving ` +
      `traffic with this build.`,
  );
  process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDb);
