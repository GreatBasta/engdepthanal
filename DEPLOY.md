# Deploying engdepthanal (so your friends can use it)

The app is a Next.js frontend plus a Postgres database. To put it online you
need two free things:

1. **A hosted Postgres database** — we'll use [Neon](https://neon.tech) (free).
2. **A host for the app** — we'll use [Vercel](https://vercel.com) (free,
   made for Next.js).

Total time: ~15 minutes. No credit card needed for either free tier.

> **Why sign-in currently fails:** the app needs a database and two
> environment variables (`DATABASE_URL`, `AUTH_SECRET`). Until those exist and
> the schema is loaded, every login/signup fails. The steps below fix that.

---

## Step 1 — Create the database (Neon)

1. Go to https://neon.tech and sign up (log in with GitHub is easiest).
2. Click **Create project**. Name it `engdepthanal`, pick a region near you,
   leave the Postgres version default. Create it.
3. On the project dashboard, find the **Connection string**. **Choose the
   "Pooled connection"** (it looks like
   `postgresql://user:pass@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
   — note the `-pooler` in the host). Copy it.

Keep this string handy — it's your `DATABASE_URL`.

---

## Step 2 — Deploy the app (Vercel)

1. Go to https://vercel.com and sign up with GitHub.
2. Click **Add New… → Project**, then **Import** the
   `Sinadehesh/engdepthanal` repository.
3. Before clicking Deploy, open **Environment Variables** and add two:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | the pooled Neon string from Step 1 |
   | `AUTH_SECRET` | any long random string — e.g. run `openssl rand -base64 32`, or use a password generator (32+ chars) |

4. Expand **Build & Development Settings** and set the **Build Command**
   (toggle "Override" on) to:

   ```
   npm run build
   ```

   Database migrations and seed writes must not run in Vercel builds. Preview
   builds can run concurrently and should never mutate the production
   database.

5. Initialize the database once from a trusted checkout after linking the
   Vercel project and pulling its development variables:

   ```bash
   vercel link
   vercel env pull .env.local --yes
   node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs migrate
   node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs src/lib/db/seed.ts
   ```

   Drizzle records applied migrations, and the seed upserts programs,
   subjects, topics, and subtopics by their unique keys, so both commands are
   safe to repeat deliberately. They are kept outside the deployment build so
   previews cannot race or modify production data.

   To ask a database whether it has everything the current checkout expects:

   ```bash
   node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs scripts/db-status.ts
   ```

   It lists any missing migrations by name and exits non-zero, so it can gate
   a release step. Run it before promoting a build if you migrate by hand —
   code that ships ahead of its schema is how `/courses` broke once already.

6. Click **Deploy**. Wait ~2 minutes.

When it finishes, Vercel gives you a URL like
`https://engdepthanal.vercel.app` — **that's the link you send your friends.**

Check `https://your-app.vercel.app/api/health` first. It answers `200` only
when the database is reachable, every migration this build expects has been
applied, and `AUTH_SECRET` is set; otherwise it answers `503` and names what
is missing:

```json
{ "status": "degraded", "migrations": { "pending": ["0005_overrated_bullseye"] } }
```

---

## Step 3 — Try it

Open the URL, click **Get started**, create an account, and onboard. Sign-in
now works because the database is live and seeded.

> **Note on the gap analysis (Phase 4):** the "what your university won't
> teach you" numbers only appear once **at least 5 students who picked the
> same university + course** have marked a subject finished and completed the
> coverage survey. With a few friends testing, have several of them choose the
> *same* university name and course to see it light up. Below 5 it shows a
> "still gathering data" screen by design.

---

## Alternatives

- **Prefer one platform for both app and DB?** [Railway](https://railway.app)
  or [Render](https://render.com) can host the Next.js app *and* a Postgres
  instance together. Set the same two env vars; for the build/start, run
  `npm run db:setup` once against the database, then `npm run build` /
  `npm start`.
- **Supabase** works anywhere Neon does — just use its **pooled** connection
  string (port 6543) as `DATABASE_URL`.

## Initialising the database manually

Load the schema and curricula from a trusted checkout:

```bash
git clone https://github.com/Sinadehesh/engdepthanal
cd engdepthanal
npm install
vercel link
vercel env pull .env.local --yes
node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs migrate
node --env-file=.env.local ./node_modules/tsx/dist/cli.mjs src/lib/db/seed.ts
```

Keep Vercel's build command set to `npm run build`.
