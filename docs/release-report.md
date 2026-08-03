# Multidisciplinary official catalogs release report

Status date: 2026-08-03
Release status: verified protected Preview; draft PR remains intentionally
unmerged and production has not been migrated or promoted

## Delivery

| Item | Value |
|---|---|
| Branch | `feature/multidisciplinary-official-catalogs` |
| Base | `main` at `7df6ba84388eec706068cfd63578fd2c286958fe` |
| Application head verified | `c64b40b66598572394f0eaca907f219f47de0a49` |
| PR | [GreatBasta/engdepthanal#20](https://github.com/GreatBasta/engdepthanal/pull/20) (draft) |
| Final Preview | [engdepthanal-qq6ibu1j9-ste11.vercel.app](https://engdepthanal-qq6ibu1j9-ste11.vercel.app) |
| Final deployment | `dpl_2r9NkV5ZA4UHGapeuZQ6JEJawAvA` |
| Vercel team/project | `ste11` / `engdepthanal` |
| Vercel project ID | `prj_YtFAzAXZzgFyipPSJAfBgeXDW8PQ` |
| Production | Unchanged |

Published logical commits:

1. `118db30` — merge the verified organization/localization/role foundation
2. `a43e49f` — add the multidisciplinary academic model
3. `f1fb897` — add safe official catalog discovery
4. `8eeacac` — redesign multidisciplinary onboarding
5. `c64b40` — expand the multidisciplinary curriculum library

## Academic model

The data model keeps these concepts separate:

- organization (the university or higher-education institution);
- organizational unit (faculty, school, college, department, institute,
  division, academy, campus, or another institution-specific unit);
- degree programme;
- official course offering;
- collaborative Course Atlas course page;
- reusable canonical curriculum template.

The taxonomy contains 18 bilingual top-level domains and 73 normalized fields.
Fields support domain, broad-field, discipline, subdiscipline and professional
area levels; aliases and translations are JSON language maps so more languages
can be added without schema changes. Programmes have many-to-many academic
fields and support Bachelor, Master, single-cycle, doctoral, professional and
other levels. Duration remains optional.

The onboarding flow combines local institutional programmes, confirmed catalog
candidates and global taxonomy search. It also stores optional organizational
unit, intake year, academic context, preferred language and an explicit
`Programme not found` request. A taxonomy choice remains a temporary fallback
that can be refined later. Account setup commits before a stale catalog scan is
scheduled with Next.js `after()`.

## Official catalog discovery

The connector registry supports:

- explicitly configured official structured APIs;
- Schema.org `Course` and `CourseInstance` JSON-LD;
- official XML sitemaps;
- semantic official HTML catalogs;
- reviewed institution-specific manual connectors.

Discovery is demand-driven. A request returns cached candidates immediately,
reuses a recent completed scan and schedules stale refreshes without blocking
onboarding. Vercel Workflow provides the durable multi-step path (one workflow,
eight steps); a bounded one-source-per-request runner persists the same
checkpoints if Workflow start is unavailable.

Safety boundaries include:

- verified ROR domains and explicitly approved provider domains only;
- HTTPS/port 443, approved-domain redirects and fail-closed DNS checks;
- private, loopback, link-local, reserved and cloud-metadata IP blocking;
- robots.txt evaluation before crawl, with longest-match handling;
- descriptive configurable crawler user agent and contact;
- serial per-domain requests with durable pauses;
- crawl depth 2, maximum 40 pages, 10-second timeout and 2 MB responses;
- HTML, JSON and XML content types only;
- no remote JavaScript execution, authentication bypass, browser automation,
  executable downloads, arbitrary PDFs or unrestricted internet crawling.

Normalized sources, scans, candidates, evidence, snapshots, matches,
corrections and metadata reviews remain distinct from official offerings and
community pages. Low-confidence candidates are never auto-published. Candidate
creation prefills only explicit official metadata; the user still chooses
canonical templates and classifies curriculum coverage. Changed official
metadata creates an Owner review and never overwrites community curriculum.

Deduplication uses, in order, stable external ID, normalized course code,
canonical official URL, then normalized name/programme/academic year. Fuzzy name
similarity alone can only suggest a match for human confirmation.

## Schema and Preview data

The complete 13-file migration chain was applied with the repository's
advisory-locked, file-by-file PostgreSQL runner to the isolated Preview
database. New files:

- `0009_pale_doctor_octopus.sql` — academic fields, organizational units,
  degree programmes and official offerings;
- `0010_slim_wallow.sql` — degree-programme bridge constraint;
- `0011_polite_madame_hydra.sql` — trusted domains, sources, scans,
  candidates, snapshots, matches, corrections and metadata reviews;
- `0012_melted_strong_guy.sql` — distinct institutional programme choices
  and richer enrollment context.

The migrations preserve existing rows. Migration `0012` replaces one obsolete
organization-plus-taxonomy unique constraint with two partial unique indexes so
two real degrees in the same broad field remain distinct. It does not drop data
columns or rows.

The canonical seed ran twice on Preview with identical results:

- 73 academic fields;
- 83 programme choices;
- 76 templates;
- 451 topics;
- 1,753 subtopics;
- 1,148 prerequisite edges.

`db:verify` reports 13 migrations and integrity `ok`. Six existing Preview
students and three resources were preserved. No demo seed, cleanup or migration
was run against production.

## Canonical curriculum library

Engineering remains available as one domain. The release adds 29 curated
templates across medicine, nursing, public health, biology, biotechnology,
chemistry, physics, mathematics, literature, linguistics, history, philosophy,
economics, law, political science, sociology, psychology, education and
communication.

Every template has a stable key, English and Italian name, description,
academic domain, discipline tags, degree levels, stage, version, curricular
status, validation metadata, source references, topics, subtopics, depth and
prerequisites. Workload is left unspecified when a defensible source does not
support it; the validator requires an explicit reason instead of fake
precision.

The generated catalog is deterministic:

- templates: 76
- topics: 451
- subtopics: 1,753
- validation checksum: `4d1eca8d6cb27e9e`

Primary reference families stored with the templates include OpenStax,
MIT OpenCourseWare, WHO public-health frameworks, AACN nursing essentials,
Cornell Legal Information Institute and Open Yale Courses. Descriptions and
topic outlines are original summaries; generated canonical content is never
labelled as an official university syllabus.

## Verification

Passed in the Cloud checkout at `c64b40b`:

- fresh `npm ci` using the lockfile;
- `npm run curriculum:validate` — 76/451/1,753;
- `npm run typecheck` — zero errors;
- `npm test` — 42 passed, 0 failed;
- `AUTH_SECRET=build-only-not-a-runtime-secret npm run build`;
- `git diff --check`;
- all 13 migrations against a production-like legacy fixture;
- distinct institutional-programme and taxonomy-fallback rehearsal;
- discovery scan idempotency and source-snapshot idempotency;
- safe-crawl, robots, redirect, size-limit and SSRF test matrix;
- no-auto-publication assertion for a 0.90-confidence candidate.

The final Vercel artifact is `READY` and uses only `npm run build`. It
compiled one Workflow with eight steps and 30 app routes. First-load sizes
remain 106 kB for Home, 135 kB for Discover, 137 kB for course creation and
133 kB for onboarding. The only build warning is the known dynamic dependency
inside the beta `@vercel/queue` package used by Workflow.

Live protected-Preview checks:

- `/api/health`: 200, database reachable;
- Home and Discover: 200, English document language and `noindex`;
- existing public university/course grouping preserved;
- onboarding and admin catalog remain authentication-protected;
- no runtime `error`, `warning` or `fatal` logs for the final deployment.

Authenticated live scanning was not executed because this Cloud session has no
approved disposable Preview identity. Connector, authorization, deduplication
and review behavior are covered by deterministic unit/integration tests with
stored sanitized official-catalog fixtures; no test depends on live university
network availability.

## Rollback and production boundary

Production aliases, production database, production Blob storage and production
environment variables were not modified. The Preview maintenance deployment
`dpl_B9298ZWmEa2RHQxwEpjvYoHPfteK` performed the isolated migration/seed
rehearsal. The final review artifact is the clean deployment
`dpl_2r9NkV5ZA4UHGapeuZQ6JEJawAvA`.

Before any production migration:

1. take and restore-test a fresh production backup;
2. rehearse the exact 13-file chain against the isolated restoration;
3. record organization, programme, course, membership, curriculum and resource
   counts before and after;
4. run the canonical seed twice and `db:verify`;
5. verify Owner/Co-owner/Visitor and catalog-review behavior with an approved
   test identity;
6. deploy the already-verified application artifact only after explicit
   authorization.

Rollback is application-first: redeploy the previous application while keeping
the additive schema. Prefer a forward fix. If data rollback is required, use
the pre-migration snapshot; do not drop new tables or enum values during an
incident.
