# Publishable mobile v1 release report

Status date: 2026-07-30  
Release status: blocked; draft work only, no merge or production promotion

## Delivery

| Item | Value |
|---|---|
| Branch | `release/publishable-mobile-v1` (local) |
| Base | `main` at `967884a` |
| Head | `b96933e` before this report update |
| PR | Not created: GitHub App returns 403 for branch/blob writes |
| Preview | Not deployed: no isolated preview DB/Blob credentials; deploying against production data would be unsafe |
| Production | Not changed |
| Vercel team/project | `ste11` / `engdepthanal` |
| Project ID | `prj_YtFAzAXZzgFyipPSJAfBgeXDW8PQ` |
| Existing production aliases | `engdepthanal-coral.vercel.app`, `engdepthanal-ste11.vercel.app` |

Local logical commits:

1. `6c1cec4` — canonical catalog and additive schema
2. `05a0bea` — unified mobile course/curriculum workflows
3. `7ea4b31` — contextual resources and confidence-aware exams
4. `e4580b0` — auth/admin/legal/observability hardening
5. `abb55e5` — release documentation and mobile E2E configuration
6. `ec66cb9` — contextual resource discussion and exam duplicate suggestions
7. `b96933e` — student-reported exam evidence and permitted materials

## Migrations and data

New additive migrations:

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
Production inspection was limited to repository schema/configuration and Vercel
build/runtime metadata. A restored test database, backup proof, migration
rehearsal, second-seed count comparison, and existing-user/course verification
remain mandatory.

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

Missing release authorization/configuration:

- GitHub App permission to create the release branch and PR (the connector
  reports `push: true`, but Git reference creation still returns HTTP 403)
- isolated preview/test PostgreSQL credentials
- isolated private Blob test store credentials/OIDC
- monitored contact email
- authorized mail provider if password reset/email verification is enabled

No secret, database URL, token, `.vercel` metadata, or PII export is committed.

## Verification evidence

Passed locally:

- `npm ci`
- `npm run curriculum:validate` — 47/306/1,173
- `npm run typecheck` — zero errors
- `npm test` — 16 passed, 0 failed
- `AUTH_SECRET=local-build-only-secret npm run build` — success, 23 static
  pages generated, build command unchanged and no DB/seed/migration invocation
- `git diff --check`

Unit/integration coverage includes curriculum validation/cycles, attachment
MIME/extension/signatures, course normalization/slugs, visibility permissions,
role capabilities, private attachment metadata, low/high-confidence exam
ranking, and deterministic recurring-question duplicate suggestions.

Not passed:

- Playwright: configured for iPhone SE, modern iPhone, Pixel 7, 768 px tablet,
  and desktop, but the environment cannot download a browser executable from
  Playwright CDN.
- Authenticated E2E and private denial: requires isolated DB/Blob.
- Drizzle migration rehearsal, seed idempotency against PostgreSQL, and
  production-safe seed on a restored test database.
- Lighthouse: not run; no score claimed.
- Full WCAG audit: semantic labels, focus styles, reduced motion, error live
  regions, and 44 px mobile nav targets were implemented, but no automated or
  manual blocker-free audit is claimed.
- Preview route/log verification: no safe preview deployment exists.

Production logs inspected before changes showed five grouped
`CredentialsSignin` errors on `/login` over seven days. Login now verifies
credentials before Auth.js sign-in and returns generic friendly errors, but this
must be confirmed in preview logs.

## Known limits and next release

The branch is not publishable yet. Required before merge:

1. authorize GitHub writes, publish the existing logical commits, and open a
   draft PR;
2. provision isolated preview DB/Blob, rehearse both migrations and idempotent
   seed, then deploy preview;
3. complete authenticated E2E for onboarding, create/combine templates,
   coverage/progress, join/roles, contextual uploads, exam/report/moderation,
   account deletion/export, admin, and private/unlisted denial;
4. finish mobile image compression/upload progress and complete a focused
   keyboard/focus-trap audit of the subtopic resource panel;
5. add/execute DB-backed tests for cloning/source immutability, migration
   preservation, duplicate reactions/occurrences, progress, moderation, and
   seed idempotency;
6. configure password reset/email verification only after an approved email
   provider exists;
7. run device overflow, keyboard/dialog, WCAG, Lighthouse, route, health, and
   structured-log checks; fix every blocker;
8. perform explicit placeholder review and cleanup only after backup and human
   confirmation.

Until those items pass, keep the PR draft, do not merge, do not apply production
migrations, and do not promote a Vercel deployment.
