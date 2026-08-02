# Worldwide organizations and collaborative curriculum release report

Status date: 2026-08-02
Release status: protected Preview deployed; draft PR remains unmerged;
production was not migrated or promoted

## Delivery

| Item | Value |
|---|---|
| Branch | `release/publishable-mobile-v1` |
| Starting head | `78aa2c30576194de52e97e7a377d3ab21b346a50` |
| Application head verified | `a50a80bb408ba56e883dd963062495bdb624904a` |
| Base | `main` at `7df6ba84388eec706068cfd63578fd2c286958fe` |
| Pull request | [GreatBasta/engdepthanal#19](https://github.com/GreatBasta/engdepthanal/pull/19) (draft) |
| Final Preview | `https://engdepthanal-5ejhusfyo-ste11.vercel.app` |
| Deployment ID | `dpl_9utqPSLLMRY62uGig9JXADuWdaTV` |
| Vercel team/project | `ste11` / `engdepthanal` |
| Project ID | `prj_YtFAzAXZzgFyipPSJAfBgeXDW8PQ` |
| Deployment target | Preview (`target: null`), READY |
| Production | Not changed |

The update contains 79 changed files, 15,051 insertions, and 2,617
deletions from the starting head. GitHub is the recovery source of truth and
the cloud working tree is aligned with the remote branch.

Published logical commits:

1. `0a52f0c` — unified organization foundation
2. `a98ce25` — primary organization context
3. `76b8b66` — authenticated Home and organization grouping
4. `a3e2c49` — Owner-approved co-ownership
5. `6d5b33a` — staged curriculum editing and Apply flow
6. `a18ffcb` — English and Italian localization
7. `8998882` — mobile loading and interaction regressions
8. `11361d0` — safe organization/role migration split
9. `d151f76` — file-by-file PostgreSQL migration runner
10. `f66655d` — reserved-connection transaction fix
11. `a50a80b` — canonical database verifier fix

## Organization architecture

The existing `universities` table remains physically stable and is the
canonical organization store. Application code exposes a normalized
organization abstraction and one reusable `OrganizationCombobox` used by
onboarding, Profile study context, course creation, course settings, and the
course directory.

`GET /api/organizations/search` validates query/country parameters with Zod,
requires two characters, searches locally first, calls ROR v2 server-side only
when needed, filters active education organizations, caches repeated searches,
rate-limits callers, and returns a bounded normalized contract. The client
debounces requests, cancels stale searches, provides accessible keyboard and
loading/empty/retry states, and requires explicit selection. A separate
request route records “university not found” submissions for admin review.

Stored ROR metadata includes ROR ID, canonical/display/normalized names,
aliases, acronyms, organization type, city, region, country code/name, domains,
primary domain, website, external source/update time, verification status, and
created/updated timestamps. Deduplication uses exact ROR ID and exact domain;
similar names are never merged automatically.

`getPrimaryEnrollmentForStudent` is the authoritative study-context helper.
Changing the primary organization changes discovery/recommendation defaults
without deleting previous memberships, courses, contributions, resources,
progress, or exam data.

## Product flows

- `/` keeps the public landing page for anonymous users and renders the
  personalized dashboard for authenticated users. `/dashboard` redirects to
  `/`.
- Home summarizes the primary university, owned/co-owned/visited courses,
  recent university courses/resources/exam activity, and pending requests.
- `/courses` defaults authenticated users to their primary university, stores
  scope and organization in URL parameters, supports “My university” and “All
  universities,” and groups public results by organization. Private and
  unlisted courses are excluded from the public directory.
- `/my-courses` groups memberships by university and separates owned/co-owned
  courses from visiting courses.
- Course creation defaults organization/program from onboarding and uses the
  shared organization search only when the user intentionally changes it.
- Profile contains primary university, program, intake year, preferred
  language, and the non-destructive university-change explanation.

## Membership and co-ownership

The user-facing model is Owner, Co-owner, and Visitor. Compatibility helpers
temporarily recognize deprecated database enum values, but the application no
longer produces them. Migration mapping is:

- `owner` to `owner`
- `editor` to `coowner`
- `contributor` and `viewer` to `visitor`

Explicit server-side helpers cover owner/co-owner/visitor identity, curriculum
editing, contribution, co-ownership review, course settings, moderation, and
archived-course deletion. Visitors can contribute resources, comments,
attachments, reactions, exam information, recurring questions, occurrences,
and reports, but cannot mutate curriculum or settings. Co-owners can edit and
apply curriculum while ownership, privacy, archive/delete, moderation, and
request review remain Owner-only.

`course_coownership_requests` stores requester, optional message, status,
reviewer, and audit timestamps. A partial unique index prevents duplicate
pending requests. Visitor request/cancel, Owner accept/reject, Owner demotion,
and Co-owner leave actions are enforced server-side. Acceptance changes the
membership transactionally and prevents self-review or non-Owner review.

## Curriculum interaction

The curriculum now uses a client-side accessible accordion with local expanded
state and lazy-loaded/cached subtopics. Expansion never calls router navigation
or submits a form. Topic cards show classification progress and bulk coverage
controls; each subtopic has direct Covered/Not covered buttons with an internal
unknown state. Advanced fields remain behind Edit details.

Coverage changes stay in client state until Apply. A persistent desktop/mobile
bar shows pending count, saving/success/failure state, retry, and discard. The
transactional batch action authenticates Owner/Co-owner access, rejects
cross-course IDs, applies all changes atomically, updates immutable history and
the current public state, updates course timestamps, and revalidates routes.
Standard UI no longer exposes draft, publish, snapshot, or version workflow
terms; it shows curriculum last-updated information instead.

Live Preview evidence on the 12-topic public Calculus curriculum: a lower topic
expanded and collapsed at `window.scrollY = 994` with a measured delta of
exactly `0 px` both times. The loaded panel returned all seven subtopics without
a route change. No banned version terminology was present.

## Localization

Typed flat dictionaries in `src/lib/i18n/messages.ts` provide English and
Italian with exact key parity and non-empty-value tests. Resolution order is
saved student preference, locale cookie, `Accept-Language`, then English.
`LocaleProvider`, the language selector, dynamic `<html lang>`, localized
metadata, and Intl date/number formatting are shared across App Router flows.

Core navigation, onboarding, Home, Discover, My courses, creation, course
shell/tabs, curriculum, resources, exam, members/settings, actions, validation,
errors, empty states, accessibility labels, roles, depth and coverage states
are localized. University/course/professor names and student-generated content
are intentionally unchanged. Academic content falls back to English rather
than rendering an empty Italian value.

Live Preview switching produced English and Italian headings/navigation,
updated `<html lang>` correctly, and preserved Italian after reload.

## Migrations and data verification

Additive files:

- `drizzle/0006_add_course_member_roles.sql`
- `drizzle/0007_organization_membership_schema.sql`
- `drizzle/0008_organization_role_backfill.sql`

PostgreSQL cannot use an enum value until the transaction that adds it commits.
The repository therefore uses `scripts/migrate.ts`, which takes an advisory
lock and commits each numbered Drizzle file separately. `npm run db:migrate`
and `db:setup` both use this runner; plain `drizzle-kit migrate` must not be
substituted for this release.

A production-like legacy rehearsal preserved all organizations, enrollments,
courses, memberships, and invites; mapped one editor to Co-owner and two legacy
reader/contributor memberships to Visitor; chose a deterministic primary
enrollment; passed a second data-backfill run; and rejected a duplicate pending
co-ownership request.

The isolated Preview database applied all nine migrations. The canonical seed
ran twice successfully. Final verification reported 47 templates, 306 topics,
1,173 subtopics, 713 prerequisite edges, no duplicate keys, no orphan progress
or resources, and `integrity: ok`. No migration, seed, or verification command
was run against production.

## Quality evidence

Passed in the cloud:

- `npm ci --cache /tmp/engdepthanal-npm-cache`
- `npm run curriculum:validate` — 47 / 306 / 1,173, checksum
  `d4574cb439e44b86`
- `npm run typecheck`
- `npm test` — 28 passed, 0 failed
- `AUTH_SECRET=preview-build-check npm run build`
- `git diff --check`
- nine-file production-like migration rehearsal
- isolated Preview migration, two seed passes, and `db:verify`
- final Vercel build using only `npm run build`

Lighthouse mobile on the exact production build in the cloud:

| Category/metric | Result |
|---|---:|
| Performance | 99 |
| Accessibility | 100 |
| Best Practices | 100 |
| SEO | 100 |
| First Contentful Paint | 0.9 s |
| Largest Contentful Paint | 2.0 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 0.9 s |

Protected Preview browser checks passed for the anonymous landing page,
English/Italian persistence, worldwide ROR results, explicit organization URL
selection, grouped Discover results, public curriculum, hidden version terms,
stable lower-topic expansion/collapse, no horizontal overflow at the cloud
browser viewport, dashboard redirect, and core semantic accessibility checks.
Home, Discover, and Curriculum each had one H1 and one main landmark, no
duplicate IDs, no missing image alt attributes, and no unlabeled visible
controls.

The repository Playwright matrix was invoked against the protected Preview
with a disposable cloud Chromium. All 50 public-matrix cases were blocked in
the shared `grantPreviewAccess` setup by the shell egress policy
(`ERR_EMPTY_RESPONSE`) before application assertions. The connected cloud
browser and Vercel authenticated fetch both reached the same deployment
successfully, so this is recorded as an infrastructure limitation rather than
an application test failure. The authenticated destructive journey was not run
without a Preview credential/browser path.

Final build logs contain no relevant warnings or errors. Final deployment
runtime logs contain no warning, error, or fatal entries, and Vercel reports no
runtime error clusters in the observed period.

## Remaining limits and authorization

1. Re-run the complete Playwright device/authenticated matrix from an approved
   runner that can reach protected `*.vercel.app` deployments and has isolated
   Preview test credentials. Include iPhone SE, modern iPhone, Pixel 7, 768 px,
   desktop, Visitor contribution, Owner approval, Co-owner curriculum Apply,
   private attachment isolation, and cleanup.
2. Restore a recent production backup into a new isolated database and repeat
   the migration/rollback rehearsal. The synthetic legacy rehearsal is not a
   substitute for authorization to access a real backup.
3. Complete manual keyboard/focus/screen-reader testing in English and Italian.
4. Keep PR #19 draft until review and required checks are complete.

No additional authorization is required for continued Preview review.
Production migration requires an authorized operator, a verified fresh backup,
production database access, and an explicit go/no-go decision. Production Blob
or environment variables were not changed.

## Production plan and rollback

1. Restore-test a fresh production backup in isolation and record pre-migration
   row counts.
2. Run `npm run db:migrate` once from a controlled job using the direct
   production connection. Verify that 0006 commits before 0007/0008.
3. Run the production-safe canonical seed and `npm run db:verify`; compare
   counts and sample existing private-course access.
4. Deploy the application only after the data checks pass. Do not make
   migrations part of ordinary Vercel builds.
5. On application regression, redeploy the prior application commit while
   retaining the additive schema and deprecated enum values. Forward-fix the
   application or schema.
6. Do not destructively remove new columns/tables/enums during incident
   response. If role data itself must be reversed, restore from the backup:
   migrated Visitor rows cannot reliably distinguish former Contributor from
   former Viewer.
