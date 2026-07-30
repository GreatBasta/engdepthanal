import { closeDb } from "./client";

async function run() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Demo seed is disabled in production");
  }
  console.log(
    "No demo records are inserted by default. Add explicit, clearly labelled local fixtures here when needed.",
  );
}

void run().finally(closeDb);
