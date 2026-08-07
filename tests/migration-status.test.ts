import assert from "node:assert/strict";
import test from "node:test";

import {
  expectedMigrations,
  outOfOrderMigrations,
  splitMigrations,
  type JournalEntry,
} from "../src/lib/db/migration-status";

const entries: JournalEntry[] = [
  { when: 100, tag: "0000_first" },
  { when: 200, tag: "0001_second" },
  { when: 300, tag: "0002_third" },
];

test("a database that has never been migrated has everything pending", () => {
  const { applied, pending } = splitMigrations(entries, null);
  assert.deepEqual(applied, []);
  assert.deepEqual(pending, ["0000_first", "0001_second", "0002_third"]);
});

test("reports the migrations a half-migrated database still needs", () => {
  const { applied, pending } = splitMigrations(entries, 200);
  assert.deepEqual(applied, ["0000_first", "0001_second"]);
  assert.deepEqual(pending, ["0002_third"]);
});

test("a fully migrated database has nothing pending", () => {
  const { applied, pending } = splitMigrations(entries, 300);
  assert.deepEqual(applied, ["0000_first", "0001_second", "0002_third"]);
  assert.deepEqual(pending, []);
});

test("a database ahead of the bundle is still up to date", () => {
  // Rolling back the application without rolling back the database: the code
  // expects less than the database has, which is not drift we can fix by
  // migrating forward.
  const { pending } = splitMigrations(entries, 999);
  assert.deepEqual(pending, []);
});

test("compares by timestamp rather than declaration order", () => {
  const shuffled: JournalEntry[] = [entries[2], entries[0], entries[1]];
  const { applied, pending } = splitMigrations(shuffled, 200);
  assert.deepEqual(applied, ["0000_first", "0001_second"]);
  assert.deepEqual(pending, ["0002_third"]);
});

test("names migrations the high-water mark would silently skip", () => {
  assert.deepEqual(outOfOrderMigrations(entries), []);
  const backdated: JournalEntry[] = [
    { when: 100, tag: "0000_first" },
    { when: 300, tag: "0001_second" },
    { when: 200, tag: "0002_backdated" },
  ];
  // 0002 sorts before 0001 by timestamp, so applying 0001 moves the mark past
  // it and Drizzle would never run 0002.
  assert.deepEqual(outOfOrderMigrations(backdated), ["0001_second", "0002_backdated"]);
});

test("the real journal is ordered and free of duplicate timestamps", () => {
  const journal = expectedMigrations();
  assert.ok(journal.length > 0, "expected the bundled journal to have entries");
  assert.deepEqual(
    outOfOrderMigrations(journal),
    [],
    "a backdated migration would be skipped silently by the migrator",
  );
  const timestamps = new Set(journal.map((entry) => entry.when));
  assert.equal(timestamps.size, journal.length, "two migrations share a timestamp");
});
