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

## 3. Preview gates

Deploy `release/publishable-mobile-v1` to project `engdepthanal` under team
`ste11`. Use an isolated preview DB and Blob store. Verify:

- public Home, Discover, legal pages, sitemap, robots, and `/api/health`;
- signup/login/onboarding and friendly invalid-credential errors;
- create course from one and multiple immutable templates;
- duplicate-course suggestion and explicit override;
- owner/editor/member permissions and private/unlisted denial;
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
