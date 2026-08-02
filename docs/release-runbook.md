# Publishable mobile v1 release runbook

This runbook is intentionally stop-the-line. A failed or unavailable gate leaves
the branch as a preview; it does not justify a production migration or promote.

## 1. Preflight and data review

1. Confirm the target project, team, branch, and production aliases.
2. Review Vercel build/runtime logs and confirm the build command is exactly
   `npm run build`.
3. Export the migration table, table counts, and a schema-only dump. Store
   backups outside the repository with restricted access.
4. Run the placeholder review query/script against production read-only access.
   Archive or delete only records a human explicitly confirms are demo data.
5. Record counts for users, memberships, courses, templates, progress,
   contributions, exam reports, moderation records, and attachments.

## 2. Migration rehearsal

1. Restore a recent production backup to a new isolated PostgreSQL database.
2. Set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to that database only.
3. Run `npm ci`, `npm run curriculum:validate`, `npm run db:migrate`,
   `npm run db:seed`, and `npm run db:verify`.
4. Run the same seed a second time and confirm counts are unchanged.
5. Compare all pre/post legacy record counts and sample existing user/course
   access. New columns may be null/defaulted; no legacy row may disappear.
6. Exercise rollback by deploying the previous application commit against the
   additive schema. Database rollback is forward-fix by default because removing
   columns or enum values is destructive.

### Organization and membership rollout

Run `npm run db:migrate`. The repository's migration runner takes a PostgreSQL
advisory lock and applies each numbered Drizzle migration in its own committed
transaction. The new files must therefore run in their numbered order:

1. `0006_add_course_member_roles.sql` adds the `coowner` and `visitor` enum
   values. PostgreSQL does not allow a newly-added enum value to be used until
   the transaction that added it has committed.
2. `0007_organization_membership_schema.sql` adds organization metadata,
   preferred-locale and primary-enrollment fields, request tables, indexes, and
   the new membership defaults.
3. `0008_organization_role_backfill.sql` normalizes legacy organizations,
   selects one deterministic primary enrollment per student, and maps legacy
   membership/invite roles (`editor` to `coowner`; `contributor` and `viewer`
   to `visitor`). The application stops producing the deprecated roles, but the
   old enum values remain available for a later verified cleanup.

Do not replace this command with `drizzle-kit migrate` for this release:
Drizzle Kit wraps all pending PostgreSQL files in one transaction, which does
not provide the required enum commit boundary.

Before any production run, take a verified backup and rehearse this exact
command against its isolated restore. Record row counts before and after for
universities, students, enrollments, courses, memberships, and invites. Run the
data-only migration a second time and verify that counts and primary enrollment
selection remain stable.

Rollback is application-first: redeploy the previous application commit while
leaving the additive columns, tables, indexes, and enum values in place. Do not
drop them during an incident. If role data itself must be restored, use the
pre-migration backup: `visitor` deliberately combines two legacy roles, so that
mapping cannot be reversed reliably from the migrated rows alone. Unused new
request tables can remain dormant until a forward fix is deployed.

## 3. Preview gates

Deploy `release/publishable-mobile-v1` to project `engdepthanal` under team
`ste11`. Use an isolated preview DB and Blob store. Verify:

- public Home, Discover, legal pages, sitemap, robots, and `/api/health`;
- signup/login/onboarding and friendly invalid-credential errors;
- create course from one and multiple immutable templates;
- duplicate-course suggestion and explicit override;
- Owner/Co-owner/Visitor permissions and private/unlisted denial;
- curriculum edit, coverage, private progress, filters, and revision history;
- contextual note/link/image/PDF flow, authorized download, report/moderation,
  soft delete, and permanent Blob cleanup;
- exam overview/material permission/occurrence duplicate protection,
  low-confidence and threshold-qualified ranking;
- profile edit, data export, account deletion, normal-account admin access;
- structured server errors and absence of credentials, private content, and
  private Blob URLs in logs.

Run:

```bash
npm run curriculum:validate
npm run typecheck
npm test
AUTH_SECRET=preview-build-check npm run build
npm run test:e2e
```

Test at 320 px/iPhone SE, modern iPhone, Pixel 7, 768 px tablet, and desktop.
Check keyboard navigation, visible focus, labels, error announcements, contrast,
reduced motion, dialog focus, headings, and absence of horizontal overflow.
Target mobile Lighthouse scores: Performance 85, Accessibility 95, Best
Practices 90, SEO 90.

## 4. Production migration and promotion

Proceed only when every preview gate is recorded as passed and an authorized
operator supplies the production database backup/migration access, private Blob
store, contact address, and any email provider used for reset/verification.

1. Put contribution writes into a documented maintenance window if needed.
2. Take and verify a fresh backup.
3. Apply migrations once from the controlled release job; never from Vercel
   build or application startup.
4. Run the production-safe canonical seed and `db:verify`.
5. Verify existing users/courses and new tables with read-only checks.
6. Promote the already-verified preview deployment.
7. Smoke-test public/private courses, attachments, admin, legal, health, and
   runtime logs. If application behavior regresses, immediately roll back the
   deployment to the previous commit; retain the additive schema for forward fix.

## Release evidence

Attach branch, PR, preview URL, exact commit, migration filenames and checksums,
route/table changes, template/topic/subtopic counts, environment-variable names,
test output, device matrix, Lighthouse/accessibility results, record-cleanup
decisions, missing authorization, known limits, and next-release scope.
