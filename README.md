# NEWEAST Guest Management

Headquarters visitor operations for **NEWEAST General Trading**: visit requests, approvals, Outlook meeting rooms, parking, hospitality, security desk, guest inbox, kiosk screens, and tracking analysis.

Production URL: [https://guest.neweast.cloud](https://guest.neweast.cloud)

The application UI is English.

## Features

- Staff visit requests, walk-in registration, QR invitations, and approval workflows
- Security desk: check-in / check-out, badges, occupancy, and gate passes
- HQ meeting-room holds through Microsoft Graph and the guest mailbox
- Parking assignment, gifts, drivers, and other guest services
- Guest inbox intake (visit requests and room replies)
- Tracking analysis with filters and pagination (visits, rooms, parking, services, activity, inbox)
- Intranet SSO and parking API for the NEWEAST intranet
- Lobby / floor display screens

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router) · React 19 · TypeScript |
| Data | Prisma 6 · SQLite |
| Styling | Tailwind CSS 4 |
| Integrations | Microsoft Graph · IMAP · SMTP · optional SQL Server / HANA |
| Runtime | Node.js 20+ · port **3088** |

## Repository layout

```text
src/app/          Routes, server actions, and API
src/components/   UI
src/lib/          Domain logic (visits, rooms, mail, Graph, access)
prisma/           Schema and seed (local demo only)
public/           Static assets, logo, user guide
docs/             Guides and intranet parking API notes
```

## Prerequisites

- Node.js 20 or later
- npm 10 or later

## Local setup

```bash
git clone https://github.com/Neweast-General-Trading/guestmangment.git
cd guestmangment
npm install
cp .env.example .env
```

Edit `.env` and set at least:

- `AUTH_SECRET` — long random string
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3088` for local work
- Graph / SMTP / IMAP keys only if you need Outlook rooms and mail

### Fresh local database (destroys existing rows)

Use this **only** on an empty machine. The seed script deletes visits and related records.

```bash
npm run db:prepare
npm run dev
```

Open [http://localhost:3088](http://localhost:3088).

Seed password for demo accounts: `neweast123`

| Email | Role |
| --- | --- |
| adminsatror@neweast.co | System administrator |
| sakour@neweast.co | Employee |
| jesman@neweast.co | Department manager |
| olga@neweast.co | HR |
| security@neweast.co | Security desk |
| karim.guard@neweast.com | Security guard |

### Existing database (do not wipe visits)

```bash
npx prisma generate
npx prisma db push
npm run dev
```

Do **not** run `npm run db:prepare` or `prisma db seed` against a live HQ database.

## Production

```bash
npm install
npx prisma generate
npx prisma db push
npm run build
npm start
```

The server listens on `0.0.0.0:3088`.

With PM2:

```bash
npx prisma generate
npm run build
pm2 restart guest-visit --update-env
pm2 save
```

Keep `.env` and `prisma/dev.db` on the server only. They are git-ignored.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server (Turbopack, port 3088) |
| `npm run build` | Production build |
| `npm start` | Production server on port 3088 |
| `npm run lint` | ESLint |
| `npm run check` | Domain unit checks (`*.check.ts`) |
| `npm run db:prepare` | Generate Prisma client, push schema, **seed (wipes data)** |

## Environment

Copy `.env.example` to `.env`. Never commit real secrets.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma SQLite path |
| `AUTH_SECRET` | Signed session secret |
| `NEXT_PUBLIC_APP_URL` | Public origin |
| `GRAPH_*` | Microsoft Graph room calendars |
| `SMTP_*` | Outbound mail |
| `GUEST_INBOX_*` | Guest mailbox IMAP |
| `INTRANET_*` | Intranet SSO / parking API |
| `SQL_DB_*` / `HANA_DB_*` | Optional employee directories |
| `TEAMS_*` / `NOTIFY_*` | Teams and notification fan-out |

## Security

- Do not commit `.env`, database files, or uploaded visitor photos
- Graph, IMAP, SMTP, SQL, and HANA credentials stay on the host
- Tracking analysis is limited to authorised emails in application access rules

## License

Private repository for NEWEAST General Trading. All rights reserved.
