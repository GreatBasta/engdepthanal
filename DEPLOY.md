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
   npm run db:setup && npm run build
   ```

   This creates the tables and loads the Calculus I curriculum into your Neon
   database automatically on the first deploy. It's safe to leave in place —
   `db:setup` is idempotent, so redeploys won't duplicate anything.

5. Click **Deploy**. Wait ~2 minutes.

When it finishes, Vercel gives you a URL like
`https://engdepthanal.vercel.app` — **that's the link you send your friends.**

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

## Initialising the database manually (optional)

If you'd rather not put `db:setup` in the build command, you can load the
schema once from your own machine instead:

```bash
git clone https://github.com/Sinadehesh/engdepthanal
cd engdepthanal
npm install
DATABASE_URL="<your pooled Neon string>" npm run db:setup
```

Then set Vercel's build command back to the default `npm run build`.
