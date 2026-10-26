# Guest Management — NEWEAST Headquarters

A web platform for **HQ visitor operations**: staff requests, approvals, Outlook meeting rooms,
parking, hospitality, security desk, guest inbox, lobby screens, and tracking analysis.

It covers the full visit path **Request → Approval → Invitation → Gate → Inside → Check-out**,
keeps room holds in sync with Microsoft 365, and gives authorised staff a single analysis board
for every visit that entered the system.

> Internal product of **New East General Trading**. See [LICENSE](LICENSE).

Production: [https://guest.neweast.cloud](https://guest.neweast.cloud)

The user interface is English.

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start (local development)](#quick-start-local-development)
- [Configuration](#configuration)
- [Production deployment](#production-deployment)
- [Access control](#access-control)
- [Backups](#backups)
- [Useful commands](#useful-commands)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## Features

**Visit desk**

- Staff visit requests (customer and employee visit types) with host, guests, purpose, timing,
  and hospitality needs (gift, driver, gate pass, parking).
- Walk-in registration at the guard desk.
- Line-manager and management approval chains, escalations, and audit timeline.
- QR invitations for guests (`/invite/[token]`).
- Reception intake of mailbox requests, plus optional AI extraction when `ANTHROPIC_API_KEY` is set.

**Rooms & Outlook**

- HQ meeting-room booking from the guest app (subject, notes, invitees).
- Holds stored in SQLite and created on the room calendar through **Microsoft Graph**.
- Tracking merges app holds with Outlook `getSchedule` so Outlook-only bookings appear as well.
- Room accept / decline from the guest mailbox.

**Gate, parking, hospitality**

- Security desk: expected guests, check-in / check-out, badges, occupancy (“Inside now”).
- Guest parking slots and staff bay assignment.
- Gift and gate-pass queues for the nominated owners.
- Service catalogue and per-visit service tasks.

**Screens & intranet**

- Lobby / floor kiosk displays (`/display/[token]`) with welcome media.
- Intranet SSO (`/sso`) using payroll / HANA identity when configured.
- Intranet parking lookup API (`/api/intranet/parking`).

**Tracking analysis**

- Restricted board for authorised emails: visits, room bookings, parking, services, activity,
  guest inbox.
- Server-side **filters** (search, date range, status, room, booker, origin, mail kind) and
  **pagination** (10 / 20 / 50).
- Newest records first. CSV export respects the active filters.
- Room table columns: Room, When, Booked by, Details (subject + notes), Invitees, Source, Status.

**Platform**

- Role-based navigation and email allow-lists for tracking and access administration.
- Email/password sign-in and optional intranet SSO.
- JWT session cookie, activity audit log, Teams / SMTP notices.

## Architecture

```
┌────────────────────┐  HTTPS   ┌───────────┐                    ┌──────────────────────────┐
│  Browser / kiosk   │ ───────▶ │   nginx   │ ─────────────────▶ │  Next.js App Router      │
│  Intranet portal   │ ◀─────── │ TLS       │   port 3088        │  PM2 name: guest-visit   │
└────────────────────┘          └───────────┘                    └─────────────┬────────────┘
                                                                               │ Prisma 6
              ┌────────────────┬─────────────────┬───────────────┬─────────────┴──────────┐
              ▼                ▼                 ▼               ▼                        ▼
         SQLite           Microsoft Graph     IMAP + SMTP    SQL Server / HANA         Teams
      prisma/dev.db       HQ room calendars   guest mailbox  payroll / SSO            notices
```

- One Node process serves pages, server actions, and `/api/*`.
- `src/proxy.ts` enforces login except for invite, display, guide, SSO, and intranet API paths.
- More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| App | Next.js 16 (App Router, Turbopack in dev), React 19, TypeScript |
| UI | Tailwind CSS 4, Lucide icons |
| Data | Prisma 6, SQLite |
| Auth | JWT (`jose`), bcryptjs, optional intranet SSO |
| Integrations | Microsoft Graph, IMAP (`imapflow`), SMTP (`nodemailer`), SQL Server, SAP HANA |
| Ops | nginx, PM2 (`guest-visit`), port **3088** |

## Repository layout

```
.
├── src/
│   ├── app/                Routes, server actions, REST handlers
│   │   ├── (app)/          Signed-in desk (visits, rooms, tracking, security, …)
│   │   ├── api/            Inbox sync, rooms, tracking export, intranet parking
│   │   ├── display/        Kiosk screens
│   │   ├── invite/         Guest invitation
│   │   ├── login/          Email sign-in
│   │   └── sso/            Intranet SSO
│   ├── components/         Shared UI (tracking board, rooms, forms)
│   ├── lib/                Domain logic (visits, Graph, mail, access, paging)
│   └── proxy.ts            Session gate and SSO query hand-off
├── prisma/
│   ├── schema.prisma       Data model
│   └── seed.ts             Local demo data only (wipes visits — never on production)
├── public/                 Logo, user guide, Excel template
├── docs/                   Architecture, deployment, security, user-guide assets
├── .env.example            All supported environment variables
└── package.json            Scripts
```

## Quick start (local development)

### Prerequisites

- **Node.js ≥ 20** and npm ≥ 10
- *Optional:* Microsoft Graph app, guest mailbox IMAP, SMTP (rooms and mail stay off until set)

### 1. Clone and install

```bash
git clone https://github.com/Neweast-General-Trading/guestmangment.git
cd guestmangment
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Minimum local values:

```dotenv
DATABASE_URL="file:./dev.db"
AUTH_SECRET="any-long-random-string"
NEXT_PUBLIC_APP_URL="http://localhost:3088"
NEXT_PUBLIC_APP_NAME="NEWEAST Guest Management"
```

Graph, SMTP, IMAP, SQL, HANA, Teams and Anthropic settings are optional. Related features
stay disabled until they are configured.

### 3. Database

**Empty machine (demo data — deletes all visits):**

```bash
npm run db:prepare
```

**Existing HQ copy (keep visits):**

```bash
npx prisma generate
npx prisma db push
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3088](http://localhost:3088).

Seed password for demo accounts: `neweast123`

| Email | Role |
| --- | --- |
| adminsatror@neweast.co | System administrator |
| sakour@neweast.co | Employee (tracking + access admin in code allow-lists) |
| jesman@neweast.co | Department manager |
| olga@neweast.co | Reception / HR |
| security@neweast.co | Security desk |

## Configuration

All settings are environment variables documented in [`.env.example`](.env.example).
The most important ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma SQLite URL (`file:./dev.db` relative to `prisma/`) |
| `AUTH_SECRET` | JWT session signing (**required in production**) |
| `NEXT_PUBLIC_APP_URL` | Public origin (invites, redirects, kiosk links) |
| `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_MAILBOX` | HQ room calendars |
| `SMTP_*` | Outbound mail |
| `MAIL_BCC` / `MAIL_DELIVER_TO` | Operations copy on outbound notices |
| `GUEST_INBOX_*` | IMAP for visit requests and room replies |
| `INTRANET_URL`, `INTRANET_API_KEY` | Intranet SSO origin and parking API key |
| `SQL_DB_*` | Optional payroll directory |
| `HANA_DB_*` | Optional intranet SSO identity |
| `TEAMS_API`, `TEAMS_WEBHOOK`, `NOTIFY_*` | Teams / notification fan-out |
| `GIFT_OWNER_EMAIL`, `GATE_PASS_OWNER_EMAIL` | Hospitality queues |
| `ANTHROPIC_API_KEY` | Optional mailbox request extraction |

Never commit a filled `.env`.

## Production deployment

A condensed outline — the full runbook is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```bash
npm ci
cp .env.example .env            # NODE production values, AUTH_SECRET, Graph, mail
npx prisma generate
npx prisma db push              # schema only
npm run build
pm2 start npm --name guest-visit -- start    # next start -H 0.0.0.0 -p 3088
pm2 save
```

After each application change on the HQ host:

```bash
npx prisma generate && npm run build && pm2 restart guest-visit --update-env && pm2 save
```

**Production checklist**

- Strong `AUTH_SECRET`; `NEXT_PUBLIC_APP_URL=https://guest.neweast.cloud`.
- TLS on nginx; app bound to localhost or the internal interface on **3088**.
- SQLite file and `.env` readable only by the service account.
- **Do not** run `npm run db:prepare` or `prisma db seed` on live data.

## Access control

- **Employee / Department manager** — visit request desk (when the access group allows it).
- **Reception (`HR_ADMIN`)** — intake, rooms, gifts, passes, screens.
- **Guard / supervisor** — security desk, inside now, walk-in.
- **Management** — reports, visits, escalations.
- **System admin** — settings, catalogue, directory, audit, staff parking.
- **Tracking analysis** — allow-list in `src/lib/access.ts` (currently operations emails such as
  `sakour@neweast.co` and `salma.moufallah@neweast.com` / `.co`), not every administrator.
- **Access page** — full-access emails only.

New production users are created from the Access screen or directory sync; do not rely on
seed passwords outside local demo.

## Backups

```bash
mkdir -p /var/backups/guest-visit
cp prisma/dev.db "/var/backups/guest-visit/dev-$(date +%F).db"
```

`prisma/dev.db`, `.env`, `data/` and `public/uploads/` hold live visitor data and are
git-ignored — never commit them.

## Useful commands

| Command | Description |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Development server (Turbopack, `0.0.0.0:3088`) |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run check` | Domain checks (`src/lib/*.check.ts`) |
| `npm run db:prepare` | Generate client, push schema, **seed (wipes data)** |
| `npx prisma generate && npx prisma db push` | Schema update without seed |

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment runbook](docs/DEPLOYMENT.md)
- [Security notes](docs/SECURITY.md)
- [Environment reference](.env.example)
- [User guide](public/guide/index.html) (PDF, slides, and walkthrough under `public/guide/`)
- [Intranet parking API](docs/NEWEAST-Intranet-Parking-API.pdf)

## Contributing

1. Create a feature branch from `main`.
2. Run `npm run lint`, `npm run check` and `npm run build` before opening a pull request.
3. Never commit secrets, `.env` files, database files, logs or visitor photos.
4. Keep user-facing text in English.

See [CONTRIBUTING.md](CONTRIBUTING.md).
