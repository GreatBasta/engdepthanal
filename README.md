# Course Atlas

Course Atlas is a mobile-first collaborative platform for real university
course pages. Students can discover a local course, compare its syllabus with
canonical multidisciplinary curriculum templates, track personal progress privately,
and share contextual resources and student-reported exam information.

The public curriculum coverage of a course and a member's private learning
progress are separate data models. Canonical templates are immutable source
material: creating a course clones one or more templates into an editable local
snapshot, so later course edits never change the library.

Student contributions are non-official. Exam reports show raw evidence and
recency; S–D tiers appear only after at least 10 approved reports, 3 sessions,
and 5 unique contributors.

## Stack and architecture

- Next.js App Router, React Server Components by default, Tailwind CSS
- Auth.js credentials flow with JWT sessions
- Drizzle ORM and PostgreSQL
- Private Vercel Blob objects with authorized application download routes
- Node test runner for unit/integration tests and Playwright for responsive E2E

| Area | Source |
|---|---|
| Database model | `src/lib/db/schema.ts` |
| Additive migrations | `drizzle/` |
| Canonical schema and validation | `src/lib/curriculum/schema.ts` |
| Canonical catalog | `curriculum/catalog.json` |
| Deterministic production seed | `src/lib/db/seed.ts` |
| Optional local demo seed | `src/lib/db/seed-demo.ts` |
| Course permissions and actions | `src/app/courses/[slug]/` |
| Official catalog connectors and policy | `src/lib/catalog/` |
| Durable catalog scan workflow | `src/workflows/catalog-scan.ts` |
| Attachment policy and authorization | `src/lib/courses/attachment-policy.ts`, `src/app/api/courses/` |
| Release and migration runbook | `docs/release-runbook.md` |

## Product routes

Primary navigation is Home, My courses, Discover, and Profile. A course has
only Overview, Curriculum, Resources, and Exam. Editing is under:

- `/courses/[slug]/settings`
- `/courses/[slug]/settings/members`
- `/courses/[slug]/settings/curriculum`
- `/courses/[slug]/settings/privacy`

Legacy `/subjects` descendants are preserved outside primary navigation while
records are mapped conservatively. Private and unlisted courses are excluded
from public discovery; private data is never cacheable or indexed.

## Canonical curriculum

The catalog contains 76 reusable templates across health, life sciences,
physical sciences, mathematics, computing, engineering, law, social sciences,
psychology, education, humanities, languages, economics, and communication.
Engineering remains one supported academic domain among many. Each JSON record has:

`templateKey`, `name`, `localizedNames`, `description`, `category`,
`academicDomainKey`, `disciplineTags`, `recommendedDegreePrograms`,
`typicalYear`, `typicalSemester`, `typicalDegreeLevels`, `typicalStage`,
`curricularStatus`, `version`, `sourceReferences`, `validationMetadata`,
`topics`, `subtopics`, `stableId`, `slug`, `description`, `depthLevel`,
`estimatedHours`, `prerequisiteStableIds`, `optional`, and `position`.

Validate the committed catalog:

```bash
npm run curriculum:validate
```

The validator checks the JSON schema, non-empty names, valid depths and hours,
unique keys/stable IDs, scoped slug uniqueness, contiguous order, duplicate
subtopics, valid source metadata, and existing acyclic prerequisites. Catalog
generation and seeded UUIDs are deterministic.

The source references point to public, authoritative curriculum pages and
frameworks including MIT OpenCourseWare, Open Yale Courses, OpenStax, WHO,
AACN, Cornell Law School, ACM/IEEE curriculum recommendations, and ABET.
Descriptions are original paraphrases. A canonical template is never labeled
as an official university syllabus, and the seed contains no fictional reviews,
exam questions, comments, or user contributions.

## Local setup

Requirements: Node.js 20+, npm, and a separate PostgreSQL database.

```bash
cp .env.example .env.local
npm ci
npm run curriculum:validate
npm run db:migrate
npm run db:seed
npm run db:verify
npm run dev
```

`db:seed` is idempotent and limited to canonical production-safe reference
data. `db:seed:demo` is explicitly local-only, never runs during a build, and
currently inserts no fake social or exam content.

## Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Runtime pooled PostgreSQL URL |
| `DATABASE_URL_UNPOOLED` | Direct URL for Drizzle migrations |
| `AUTH_SECRET` | Auth.js signing secret and rate-limit hashing |
| `BLOB_READ_WRITE_TOKEN` | Private Blob access; Vercel OIDC may be used instead |
| `ADMIN_EMAILS` | Temporary bootstrap allowlist; promote the account to `students.admin_role` |
| `NEXT_PUBLIC_APP_URL` | Canonical deployed origin |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Monitored privacy, safety, and removal contact |

Never commit `.env*`, `.vercel`, database exports, Blob tokens, email
credentials, or user data. Email verification and password-reset messages must
not be enabled until an authorized provider and monitored sender are configured.

## Database and release safety

`npm run build` is and must remain the Vercel build command. It does not migrate,
seed, or require a database connection while compiling. Apply migrations from a
controlled release job using the direct database URL only after backup and a
successful rehearsal against a restored, isolated database.

The new migrations are additive: they create tables, columns, indexes, foreign
keys, and enum values without deleting legacy rows. Do not deploy application
code that reads new columns before the migration is verified. See
`docs/release-runbook.md` for backup, rehearsal, verification, rollback, preview,
and production gates.

## Tests

```bash
npm run curriculum:validate
npm run typecheck
npm test
AUTH_SECRET=local-build-only-secret npm run build
npm run test:e2e
```

Playwright covers iPhone SE, a modern iPhone, Pixel 7, a 768 px tablet, and
desktop. Full authenticated course, upload, private-denial, and migration tests
require an isolated seeded E2E database and private Blob test store; they must
never target production.

## Administration and moderation

There is no dedicated admin credential endpoint. An administrator signs in
through the normal account flow and must have `students.admin_role = true`.
`ADMIN_EMAILS` is only a first-admin bootstrap path.

Reports use unified reasons (spam, harassment, personal information, copyright,
unauthorized exam material, incorrect information, inappropriate, or other).
Moderation is soft-delete-first with audit records. Permanent attachment
deletion must remove both the database record and private Blob object.

## Deployment

The existing Vercel project is `engdepthanal` in team `ste11`. Branches deploy
as previews in the same project. Never promote a preview until migrations,
private/unlisted authorization, mobile E2E, accessibility, logs, and the release
checklist are verified. Production promotion is a separate explicit operation.
