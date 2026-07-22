# engdepthanal — Engineering Depth Analysis

A learning-tracking platform for first-year engineering students. It shows a
student exactly what they need to learn in each subject, tracks what they have
covered, and — by aggregating survey data from students who have **finished**
each subject — reveals what their own university does *not* teach them.

Two sources of truth drive everything:

1. **Canonical curriculum** — the comprehensive, university-independent map of
   everything a first-year engineering student should know, organized as
   *Subject → Topic → Subtopic*, each subtopic tagged with a target **depth
   level**. We start with Calculus I.
2. **Observed coverage** — what universities *actually* teach, reconstructed
   from surveys of finished students ("Have you studied: using derivatives to
   solve real-world optimization?") plus their grade.

The gap between the two, aggregated per university + course, is the depth
analysis this project is named for.

## Repository layout

| Path | What |
|---|---|
| [`STRUCTURE.md`](STRUCTURE.md) | Full design: product concept, user journeys, entity model, depth levels, survey design, data-quality rules, aggregation pipeline, app routes, phased build order |
| [`src/lib/db/schema.ts`](src/lib/db/schema.ts) | The Drizzle schema (all 15 tables) — [`db/schema.sql`](db/schema.sql) is the original raw-SQL reference |
| [`drizzle/`](drizzle/) | Generated migrations, incl. the finished-only survey guard trigger |
| [`curriculum/calculus-1.json`](curriculum/calculus-1.json) | Comprehensive Calculus I taxonomy — 12 topics, 105 subtopics with depth levels, estimated hours, and a prerequisite graph |
| [`src/lib/db/seed.ts`](src/lib/db/seed.ts) | Idempotent seed: engineering programs + curriculum JSON files |
| [`src/app/`](src/app/) | Next.js app: login/signup, onboarding, dashboard, subject tree |

Stack: Next.js (App Router) + Drizzle ORM + Postgres + next-auth
(email + password, JWT sessions) + Tailwind v4. Built with Fable 5.

## Running locally

```bash
cp .env.example .env        # set DATABASE_URL and AUTH_SECRET
npm install
npm run db:migrate          # apply migrations to your Postgres
npm run db:seed             # programs + Calculus I curriculum (safe to re-run)
npm run dev
```

`npm run aggregate` recomputes the coverage aggregates that power the gap
analysis (the "nightly job"; also refreshed live as students submit surveys).

## Deploying it online

To put the MVP on the web (free) so others can use it, see
[`DEPLOY.md`](DEPLOY.md) — a step-by-step guide using Neon (Postgres) +
Vercel (the app). Sign-in fails until a database is connected and seeded;
that guide fixes it.

Then sign up, name your university and course (added automatically if it's
not in the database yet), say whether you're **starting** or **actively
attending** first year, and the first-year database unlocks.

## Build status

Phases 1–4 are built and verified end-to-end:

- **Phase 1** — schema + migrations, Calculus I seed, auth, onboarding, the
  read-only branch outlook per subject.
- **Phase 2** — the interactive progress tracker and the finish gate.
- **Phase 3** — grade capture and the chunked, resumable coverage survey
  (finished subjects only).
- **Phase 4** — the coverage-aggregation pipeline (weighted, sample-gated)
  plus the gap-analysis page and coverage badges on the outlook.

**Next (see STRUCTURE.md §8):** Phase 5 — remaining first-year subjects
(linear algebra, physics I, …), curriculum-suggestion review, and cohort /
grade analytics.
