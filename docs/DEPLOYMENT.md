# Deployment runbook

Production host serves [https://guest.neweast.cloud](https://guest.neweast.cloud).
The Node process is **PM2 `guest-visit`** on port **3088**, with nginx in front.

## First install

```bash
git clone https://github.com/Neweast-General-Trading/guestmangment.git
cd guestmangment
npm ci
cp .env.example .env          # fill secrets on the server only
npx prisma generate
npx prisma db push            # schema only — does not wipe visits
npm run build
pm2 start npm --name guest-visit -- start
pm2 save
pm2 startup                   # once, if not already configured
```

Point nginx `guest.neweast.cloud` to `http://127.0.0.1:3088` with TLS.

## Application update (keep visits)

After code changes:

```bash
npx prisma generate && npm run build && pm2 restart guest-visit --update-env && pm2 save
```

Never run `npm run db:prepare` or `npx prisma db seed` on this host.

## Environment

`.env` stays on the server (git-ignored). Required in production:

- `AUTH_SECRET` — long random string
- `NEXT_PUBLIC_APP_URL=https://guest.neweast.cloud`
- `DATABASE_URL=file:./dev.db`
- Graph / SMTP / IMAP credentials for rooms and mail

See [`.env.example`](../.env.example).

## Process

| Item | Value |
| --- | --- |
| PM2 name | `guest-visit` |
| Listen | `0.0.0.0:3088` |
| Start command | `npm start` → `next start -H 0.0.0.0 -p 3088` |
| Database file | `prisma/dev.db` |

## Backups

Copy the SQLite file while the app can be briefly idle, or use a filesystem snapshot:

```bash
cp prisma/dev.db "/var/backups/guest-visit/dev-$(date +%F).db"
```

Keep `.env` in the same restricted backup set. Do not commit either file.

## Rollback

```bash
git checkout <previous-commit>
npx prisma generate && npm run build && pm2 restart guest-visit --update-env && pm2 save
```
