# Publishable mobile v1 release report

Status date: 2026-07-30  
Release status: verified Preview candidate; draft PR remains intentionally
unmerged and production has not been promoted

## Delivery

| Item | Value |
|---|---|
| Branch | `release/publishable-mobile-v1` |
| Base | `main` at `967884a` |
| Application head verified | `ed700c5` |
| PR | [GreatBasta/engdepthanal#18](https://github.com/GreatBasta/engdepthanal/pull/18) (draft) |
| Preview | `https://engdepthanal-marzobar-3689-ste11.vercel.app` |
| Production | Not changed |
| Vercel team/project | `ste11` / `engdepthanal` |
| Project ID | `prj_YtFAzAXZzgFyipPSJAfBgeXDW8PQ` |
| Existing production aliases | `engdepthanal-coral.vercel.app`, `engdepthanal-ste11.vercel.app` |

Published logical commits:

1. `6c1cec4` — canonical catalog and additive schema
2. `05a0bea` — unified mobile course/curriculum workflows
3. `7ea4b31` — contextual resources and confidence-aware exams
4. `e4580b0` — auth/admin/legal/observability hardening
5. `abb55e5` — release documentation and mobile E2E configuration
6. `ec66cb9` — contextual resource discussion and exam duplicate suggestions
7. `b96933e` — student-reported exam evidence and permitted materials
8. `2cdaa9b` — private attachment lifecycle and mobile upload handling
9. `d3a5dc6` / `69f6053` — bounded release tooling and deployment archive
10. `775137d` / `0b245d7` — private-course and Blob lifecycle E2E
11. `df95822` — persistent multi-template wizard selection
12. `ed700c5` — application icon metadata

## Migrations and data

The complete additive migration chain was applied to an isolated Preview
database:

- `drizzle/0000_nifty_stardust.sql`
- `drizzle/0001_finished_guard_trigger.sql`
- `drizzle/0002_mute_dreadnoughts.sql`
- `drizzle/0003_outgoing_dakota_north.sql`
- `drizzle/0004_flippant_red_skull.sql`
- `drizzle/0005_overrated_bullseye.sql`

New tables:

- `course_subtopic_progress`
- `course_resources`
- `course_resource_comments`
- `course_resource_reactions`
- `rate_limit_buckets`

Existing tables receive only nullable or defaulted columns and indexes. The
migrations contain no `DROP`, truncation, delete, seed, or binary payload.
Template seed IDs are deterministic and inserts are conflict-safe.

No migration, seed, cleanup, archive, or deletion was run against production.
The canonical seed ran twice on the isolated Preview database with identical
results: 10 programs, 47 templates, 306 topics, 1,173 subtopics, and 713
prerequisites, with no duplicate template versions or orphan topics.

E2E cleanup used a Preview-only database. PostgreSQL cascade behavior also
removed the canonical templates because `curriculum_templates.created_by`
references students; the deterministic canonical seed was immediately restored
and reverified. The final Preview state contains the full canonical catalog and
zero test students, courses, universities, or attachments. Production was never
connected to this cleanup. A restored production-backup rehearsal and rollback
proof remain mandatory before production migration.

## Routes

Added:

- `/my-courses`
- `/profile`
- `/api/account/export`
- `/api/health`
- `/courses/[slug]/settings`
- `/courses/[slug]/settings/members`
- `/courses/[slug]/settings/curriculum`
- `/courses/[slug]/settings/privacy`
- `/privacy`
- `/terms`
- `/community-guidelines`
- `/copyright`
- `/contact`
- `/robots.txt`
- `/sitemap.xml`

Changed/retired:

- `/dashboard` reliably redirects to `/my-courses`.
- `/admin/login` redirects to normal `/login?next=/admin`; dedicated
  username/password admin actions and UI were removed.
- Public course tabs are Overview, Curriculum, Resources, and Exam.
  Contributors and Community are no longer public tabs.
- Legacy `/subjects/[slug]/survey`, `/swipe`, and `/gaps` redirect using the
  reliable subject slug to the read-only subject view.
- Legacy records and `/subjects/[slug]/track` remain preserved outside primary
  navigation. No uncertain legacy progress mapping was attempted.

## Curriculum catalog

Totals: 47 templates, 306 topics, 1,173 subtopics. Deterministic validation
checksum: `d4574cb439e44b86`.

| Template | Topics | Subtopics |
|---|---:|---:|
| Anatomy and Physiology | 6 | 18 |
| Biology for Engineers | 6 | 18 |
| Biomaterials | 6 | 18 |
| Biomechanics | 6 | 18 |
| Biomedical Signals | 6 | 18 |
| Calculus I | 12 | 105 |
| Calculus II | 6 | 18 |
| Circuit Analysis | 6 | 18 |
| Classical Mechanics | 12 | 97 |
| Complex Numbers and Transform Methods | 6 | 18 |
| Computer Architecture and Digital Logic | 6 | 18 |
| Control Systems | 6 | 18 |
| Data Science Fundamentals | 6 | 18 |
| Data Structures and Algorithms | 6 | 18 |
| Database Fundamentals | 6 | 18 |
| Discrete Mathematics | 6 | 18 |
| Dynamics | 6 | 18 |
| Electricity and Magnetism | 6 | 18 |
| Electronics | 6 | 18 |
| Engineering Design | 6 | 18 |
| Engineering Drawing and CAD | 6 | 18 |
| Engineering Project Management | 6 | 18 |
| Engineering Thermodynamics | 6 | 18 |
| Fluid Mechanics | 6 | 18 |
| General Chemistry for Engineers | 12 | 96 |
| Linear Algebra | 12 | 101 |
| Engineering Materials and Manufacturing Processes | 6 | 18 |
| Materials Science and Engineering | 6 | 18 |
| Measurement and Instrumentation | 6 | 18 |
| Mechanics of Materials | 6 | 18 |
| Medical Imaging | 6 | 18 |
| Modern Physics Fundamentals | 6 | 18 |
| Multivariable Calculus | 6 | 18 |
| Numerical Methods | 6 | 18 |
| Object-Oriented Programming | 6 | 18 |
| Optimization Fundamentals | 6 | 18 |
| Ordinary Differential Equations | 6 | 18 |
| Organic and Biochemistry for Engineers | 6 | 18 |
| Probability and Statistics | 6 | 18 |
| Programming Fundamentals | 6 | 18 |
| Scientific Computing | 6 | 18 |
| Signals and Systems | 6 | 18 |
| Statics | 6 | 18 |
| Technical Communication | 6 | 18 |
| Thermodynamics | 6 | 18 |
| Waves and Optics | 6 | 18 |
| Web and Software Engineering Fundamentals | 6 | 18 |
| Total | 306 | 1,173 |

Source families stored per template:

- MIT OpenCourseWare course and search pages
- OpenStax Calculus, University Physics, Chemistry, Biology, and Anatomy and
  Physiology
- ACM/IEEE Computing Curricula 2020 and CS2023 recommendations
- ABET Criteria for Accrediting Engineering Programs 2025–2026

Descriptions are paraphrased. The canonical seed has no fake reviews, comments,
exam questions, occurrences, or other social data.

## Environment

Documented variables:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `AUTH_SECRET`
- `BLOB_READ_WRITE_TOKEN` (or Vercel OIDC)
- `ADMIN_EMAILS` (bootstrap only)
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CONTACT_EMAIL`

Preview-only configuration provisioned:

- isolated Neon store `engdepthanal-preview-v1`
- isolated private Blob store `engdepthanal-preview-attachments` in FRA1
- rotated Preview `AUTH_SECRET`

Still missing for production release:

- monitored contact email
- authorized mail provider if password reset/email verification is enabled

No secret, database URL, token, `.vercel` metadata, or PII export is committed.

## Verification evidence

Passed locally and/or against the protected Vercel Preview:

- `npm ci`
- `npm run curriculum:validate` — 47/306/1,173
- `npm run typecheck` — zero errors
- `npm test` — 16 passed, 0 failed
- `npm run build` — success, 24 static pages/assets; build command unchanged
  and no DB/seed/migration invocation
- `git diff --check`
- Drizzle Preview rehearsal — all 6 migrations applied
- canonical seed idempotency — two runs, identical totals and zero duplicates
- Playwright public/device matrix — 28 passed, 6 intentional
  device-specific skips
- Playwright authenticated Pixel 7 journey — signup, onboarding, private
  course, combined templates, curriculum publish, contextual resource,
  private Markdown attachment, anonymous course/attachment denial,
  hide/restore/permanent Blob removal, and account export
- final iPhone SE smoke — home, horizontal overflow, and `/api/health`
- final deployment runtime logs — no `error` or `fatal` entries
- Lighthouse mobile — Performance 89, Accessibility 100, Best Practices 100,
  SEO 63

Unit/integration coverage includes curriculum validation/cycles, attachment
MIME/extension/signatures, course normalization/slugs, visibility permissions,
role capabilities, private attachment metadata, low/high-confidence exam
ranking, and deterministic recurring-question duplicate suggestions.

The Lighthouse SEO score is intentionally reduced by Vercel's protected Preview
`noindex` response; the application's robots audit passes. Accessibility 100 is
automated evidence, not a substitute for a complete manual keyboard,
focus-order, and screen-reader audit.

`npm audit` still reports 10 transitive findings (4 moderate, 4 high, 2
critical). No breaking dependency upgrade was applied without a separate
compatibility pass.

## Known limits and next release

The Preview candidate is suitable for review, but these safeguards remain
before merge or production promotion:

1. take and restore-test a production backup, rehearse the additive migrations
   against that restored copy, document rollback, and verify existing
   users/courses;
2. resolve or explicitly accept the 10 `npm audit` findings after compatibility
   testing;
3. complete manual keyboard/focus/screen-reader review and extend authenticated
   write E2E beyond Pixel 7 to the remaining target devices;
4. exercise join/roles, exam occurrence/report moderation, admin, and account
   deletion against a production-like restored dataset;
5. configure a monitored contact address and an approved mail provider before
   enabling reset/verification;
6. add required GitHub checks and branch protection because the draft PR
   currently has no CI status checks;
7. review production placeholders with an explicit export/backup before any
   archive or delete action.

Keep PR #18 draft and do not merge, migrate production, or promote the Preview
until these items are closed.
