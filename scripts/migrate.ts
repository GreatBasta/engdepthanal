import { readMigrationFiles } from "drizzle-orm/migrator";
import postgres from "postgres";

const MIGRATION_LOCK_NAMESPACE = 2_026_080_2;
const MIGRATION_LOCK_ID = 1;

async function migrate() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");
  }

  const client = postgres(url, { max: 1, prepare: false });
  const connection = await client.reserve();

  try {
    await connection`select pg_advisory_lock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_ID})`;
    await connection.unsafe('create schema if not exists "drizzle"');
    await connection.unsafe(`
      create table if not exists "drizzle"."__drizzle_migrations" (
        id serial primary key,
        hash text not null,
        created_at bigint
      )
    `);

    const [lastMigration] = await connection<
      { created_at: string | number | null }[]
    >`
      select created_at
      from "drizzle"."__drizzle_migrations"
      order by created_at desc
      limit 1
    `;
    let lastAppliedAt = Number(lastMigration?.created_at ?? 0);
    const migrations = readMigrationFiles({ migrationsFolder: "./drizzle" });

    for (const migration of migrations) {
      if (lastAppliedAt >= migration.folderMillis) continue;

      await connection.begin(async (transaction) => {
        for (const statement of migration.sql) {
          if (statement.trim()) await transaction.unsafe(statement);
        }
        await transaction`
          insert into "drizzle"."__drizzle_migrations" (hash, created_at)
          values (${migration.hash}, ${migration.folderMillis})
        `;
      });

      lastAppliedAt = migration.folderMillis;
      console.log(`Applied migration ${migration.folderMillis}`);
    }
  } finally {
    try {
      await connection`select pg_advisory_unlock(${MIGRATION_LOCK_NAMESPACE}, ${MIGRATION_LOCK_ID})`;
    } finally {
      connection.release();
      await client.end({ timeout: 5 });
    }
  }
}

migrate().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
