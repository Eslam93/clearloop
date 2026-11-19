# Deploying ClearLoop

ClearLoop runs on Vercel with a Postgres database. These steps use Neon's free tier. Any Postgres 15 or newer works the same way.

Local development needs none of this: `pnpm dev` starts an embedded Postgres.

## 1. Create the database

1. Create a Neon project. Keep the default database and owner role.
2. Copy two connection strings from the Neon console:
   - the **direct** connection string, for migrations (the owner role);
   - the **pooled** connection string (host with `-pooler`), for the app.
3. Pick a long random password for the app role, for example with `openssl rand -base64 32`.

## 2. Migrate

Run this from the repository root, with the direct owner connection string:

```bash
DATABASE_URL_OWNER="postgres://<owner>:<password>@<host>/<db>?sslmode=require" \
APP_DB_PASSWORD="<the app role password>" \
pnpm db:migrate
```

This creates the tables, row-level security and the `clearloop_app` role. With `APP_DB_PASSWORD` set it also gives that role `LOGIN` and the password. Running it again only applies new migrations.

The app must connect as `clearloop_app`, never as the owner. The owner skips nothing it should not, but `clearloop_app` is the role the tenancy tests prove.

## 3. Configure Vercel

In the Vercel project:

- **Settings → Build and Deployment → Root Directory:** `apps/web`. Keep "Include files outside the root directory" on; the workspace packages live in `packages/`.
- **Settings → Environment Variables:**

| Variable | Value |
|---|---|
| `DATABASE_URL` | The **pooled** connection string with user `clearloop_app` and its password |
| `SESSION_SECRET` | At least 32 random characters. Signs the sandbox cookie |
| `CRON_SECRET` | Random. Vercel Cron sends it to `/api/cron/sweep` |
| `NEXT_PUBLIC_SITE_URL` | The public URL, for social cards |

The WhatsApp variables (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`) stay unset for the public demo. Without them nothing can send a real message.

## 4. Deploy

Merge to `main`. Vercel builds `apps/web` and deploys it. Check that:

- `/api/health` returns `{"ok":true,"database":true}`;
- **Open the live demo** creates a sandbox.

## 5. Cleanup and retries

`apps/web/vercel.json` schedules `/api/cron/sweep` once a day, the most the Hobby plan allows. That purges expired sandboxes and retries any due messages. On a paid plan, run it every minute. Why the demo works without that is in [decision 0008](decisions/0008-the-sweeper-rides-on-the-stream-in-the-demo.md).

## 6. Custom domain (optional)

Add the domain in Vercel (for example `clearloop.eslamhamed.com`), point a CNAME at Vercel, and update `NEXT_PUBLIC_SITE_URL`.
