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
| [`db/schema.sql`](db/schema.sql) | Complete Postgres schema (portable to Drizzle) |
| [`curriculum/calculus-1.json`](curriculum/calculus-1.json) | Comprehensive Calculus I taxonomy — 12 topics, 105 subtopics with depth levels, estimated hours, and a prerequisite graph |

Stack target: Next.js (App Router) + Drizzle ORM + Postgres. Built with
Fable 5.

See [`STRUCTURE.md`](STRUCTURE.md) for the complete design and the phased
build order.
