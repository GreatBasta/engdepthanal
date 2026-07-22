import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Run migrations over a DIRECT connection when one is available.
    // Neon/Supabase expose an unpooled URL (e.g. DATABASE_URL_UNPOOLED);
    // migrations (DDL) are more reliable off the transaction-mode pooler.
    // Falls back to DATABASE_URL for local/direct setups.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
  },
});
