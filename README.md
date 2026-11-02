# Guest Management — NEWEAST Headquarters

Web desk for visitor operations at NEWEAST HQ. Staff submit a guest visit, reception prepares it, the meeting room is booked, and security receives the visit when it is ready.

Production: [https://guest.neweast.cloud](https://guest.neweast.cloud)

The screens are in English. This repository is an internal product of **New East General Trading**. See [LICENSE](LICENSE).

---

## Table of contents

- [What the app does](#what-the-app-does)
- [How a visit moves](#how-a-visit-moves)
- [Desks and who uses them](#desks-and-who-uses-them)
- [Notices](#notices)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Production](#production)
- [Backups](#backups)
- [Commands](#commands)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## What the app does

**Visit requests**

- An employee submits a guest visit with a title, date, arrival, end time, room, guests, and optional hospitality.
- Each guest can have an ID, passport, and visa file. Those files stay with that guest.
- A visit can ask for a driver, a protocol gift, a gate pass, a building tour, and parking.
- Cards and titles use the same headline: visit title and requester on the first line, room under it, visit code in small type at the bottom right.

**Reception**

- A new staff request goes straight to reception. The stored status stays `INTAKE`.
- The pill says **Preparing** while something is still open, and **Ready** when the room, driver, gate passes, gifts, building tour, and guest list are complete.
- Reception books a ground-floor city room. A room that is already booked cannot be selected.
- Reception can also register a visitor immediately from the rooms desk.
- When reception sends the visit to security, the status becomes **Expected**.

**Gate pass**

- Approve the gate pass first. The file upload appears only after approval.
- Each guest has a separate gate pass card. That guest’s attachments sit on the right of the card.
- The queue is paged, four cards at a time.
- The uploaded gate pass is a different file from the guest’s ID, passport, or visa.

**Rooms and Outlook**

- HQ room holds are stored in the app and created on the room calendar through Microsoft Graph.
- Invitations already sent from Guest Management are not sent again by routine jobs.
- If someone books an HQ room in Outlook outside Guest Management, reception and Salma receive one notice for that event.
- The tracking board lists visits and rooms from the newest appointment to the oldest.

**Security and hospitality**

- The guard desk covers expected guests, check-in, check-out, badges, and who is inside.
- Driver requests are confirmed on the driver desk.
- Protocol gifts are approved by the gift owner, then marked received at reception.
- Lobby screens are served at `/display/[token]`.

## How a visit moves

```
Employee submits
      │
      ▼
Reception  ·  Preparing
      │     room, driver, gift, gate pass, tour, guests
      ▼
Reception  ·  Ready
      │
      ▼
Security   ·  Expected
      │
      ▼
Arrived → Inside → Checked out
```

A building tour still needs its own approval. A cancelled visit stays in the record; it is not removed to hide it.

Guest identity files can be opened by the person who uploaded them, by reception, and by the gate-pass desk. Other accounts do not receive those files.

## Desks and who uses them

Access is a role plus a few named mailboxes. The Access page itself is only for the super-admin mailboxes.

| Desk | Who | What they do |
| --- | --- | --- |
| Visit request | Employees and managers | Submit and follow their own guest visits |
| Visit requests | Reception | Prepare the visit, book the room, send it to security |
| Gate passes | Reception | Approve, read the guest’s documents, upload the pass |
| Meeting rooms | Reception, and the room bookers | Book a free ground-floor room, or view the board |
| Driver requests | Sachini | Confirm that the driver was contacted |
| Parking assign | Sachini | Assign a staff bay |
| Gift requests | Gift owner, reception can close them | Approve a protocol gift, then mark it received |
| Guard desk | Security | Expected guests, walk-in, check-in and check-out |
| Tracking analysis | Named allow-list in `src/lib/access.ts` | Visits, rooms, parking, services, inbox |
| Access | `sakour@neweast.co` and `guru@neweast.co` / `guru@neweast.com` | The only accounts that manage the Access page |

Named duties in the current HQ setup:

- **Reception and gate pass:** `frontdesk@neweast.com` (Muna).
- **Same reception duties and the same reception emails:** `sachini@neweast.com`, in addition to room booking, parking assign, and driver requests.
- **New visit notice:** Salma (`salma.moufallah@neweast.com` and `.co`) is told when a guest visit is submitted. She does not replace reception.
- **Rooms view only:** Maria, Carina, and Hannah can see the room board.
- **Protocol gifts:** the gift owner mailbox in `GIFT_OWNER_EMAIL`.

Sachini keeps driver, parking, and room booking. Those were not replaced when reception was added.

## Notices

These go out when the event happens. Old visits are not emailed again.

| Event | Who is told |
| --- | --- |
| A guest visit is submitted | Reception, and Salma |
| A gate pass is required | Reception (Muna and Sachini) |
| A driver is required | Sachini |
| A protocol gift is required | The gift owner |
| An HQ room is booked in Outlook outside this app | Muna and Salma, once per Outlook event |
| A service on the visit catalogue is opened | The owners of that service |

Operational mail is sent from the guest mailbox. Hidden copy behaviour is controlled by `MAIL_BCC` and is documented in `.env.example`.

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
- `src/proxy.ts` requires a session except for invite, display, guide, SSO, and the intranet parking API.
- More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript |
| UI | Tailwind CSS 4, Lucide icons |
| Data | Prisma 6, SQLite (`prisma/dev.db`) |
| Auth | JWT (`jose`) in the `neweast_session` cookie, bcryptjs, optional intranet SSO |
| Integrations | Microsoft Graph, IMAP, SMTP, SQL Server, SAP HANA |
| Ops | nginx, PM2 process `guest-visit`, port **3088** |

## Repository layout

```
.
├── src/
│   ├── app/                Routes, server actions, HTTP handlers
│   │   ├── (app)/          Signed-in desks
│   │   ├── api/            Documents, gate passes, inbox, rooms, exports
│   │   ├── display/        Lobby screens
│   │   ├── invite/         Guest invitation
│   │   ├── login/          Email sign-in
│   │   └── sso/            Intranet SSO
│   ├── components/         Shared screens and forms
│   ├── lib/                Visits, rooms, mail, permissions, notices
│   └── proxy.ts            Session gate
├── prisma/
│   ├── schema.prisma       Data model
│   └── seed.ts             Local demo data only. It wipes visits. Never run it on HQ.
├── public/                 Logo and the user guide
├── docs/                   Architecture, deployment, security
├── .env.example            Environment variables, without secrets
└── package.json
```

Guest documents and gate-pass files are stored on disk under `data/`. That folder is not in git.

## Quick start

### Prerequisites

- Node.js 20 or newer, and npm 10 or newer
- Optional: Microsoft Graph, the guest mailbox, and SMTP. Rooms and mail stay off until those are set.

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

Graph, SMTP, IMAP, SQL, HANA, Teams, and Anthropic stay unused until they are filled in. Do not commit `.env`.

### 3. Database

Empty machine, with demo accounts. This **deletes every visit**:

```bash
npm run db:prepare
```

An existing database, keeping visits:

```bash
npx prisma generate
npx prisma db push
```

If `db push` warns that it would drop columns, stop. Do not pass `--accept-data-loss`.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3088](http://localhost:3088).

The seed password for local demo accounts is ``.

| Email | Local demo role |
| --- | --- |
| adminsatror@neweast.co | System administrator |
| sakour@neweast.co | Employee, and an Access-page admin in the allow-list |
| jesman@neweast.co | Department manager |
| olga@neweast.co | Reception |
| security@neweast.co | Security desk |

HQ production accounts are not these seed users. Create them from Access or the payroll sync.

## Configuration

Every variable is listed in [`.env.example`](.env.example).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite file, usually `file:./dev.db` under `prisma/` |
| `AUTH_SECRET` | Signs the session cookie. Required in production |
| `NEXT_PUBLIC_APP_URL` | Public origin used in links |
| `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_MAILBOX` | Room calendars |
| `SMTP_*` | Outbound mail from the guest mailbox |
| `MAIL_BCC`, `MAIL_DELIVER_TO` | Operations copy on outbound notices |
| `GUEST_INBOX_*` | Inbox used for emailed visit requests and room replies |
| `INTRANET_URL`, `INTRANET_API_KEY` | Intranet SSO and the parking API |
| `SQL_DB_*` | Optional payroll directory |
| `HANA_DB_*` | Optional intranet identity |
| `TEAMS_API`, `TEAMS_WEBHOOK`, `NOTIFY_*` | Teams and notification fan-out |
| `GIFT_OWNER_EMAIL` | Who approves protocol gifts |
| `GATE_PASS_OWNER_EMAIL` | Primary gate-pass mailbox. Defaults to reception |
| `ANTHROPIC_API_KEY` | Optional extraction of emailed visit requests |

## Production

Full runbook: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```bash
npm ci
cp .env.example .env
npx prisma generate
npx prisma db push
npm run build
pm2 start npm --name guest-visit -- start
pm2 save
```

`npm start` listens on `0.0.0.0:3088`. nginx terminates TLS for `https://guest.neweast.cloud`.

After an application change on the HQ host:

```bash
npx prisma generate && npm run build && pm2 restart guest-visit --update-env && pm2 save
```

Run `npx prisma db push` only when `prisma/schema.prisma` changed. Never use `--accept-data-loss` on the live database.

**Do not run** `npm run db:prepare` or `prisma db seed` on the HQ database. Both replace live visits with demo data.

Production also needs a long `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL=https://guest.neweast.cloud`, and file permissions so only the service account can read `prisma/dev.db` and `.env`.

## Backups

```bash
mkdir -p /var/backups/guest-visit
cp prisma/dev.db "/var/backups/guest-visit/dev-$(date +%F).db"
```

`prisma/dev.db`, `.env`, `data/`, and uploaded media are git-ignored. They hold visitor records and must stay off GitHub.

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Development server on port 3088 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run check` | Domain checks in `src/lib/*.check.ts` |
| `npm run db:prepare` | Generate, push, and seed. Wipes visits |
| `npx prisma generate && npx prisma db push` | Apply schema changes and keep the data |

`npm run check` is the project’s check suite. It is not a substitute for `npx tsc --noEmit`.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Security](docs/SECURITY.md)
- [Environment reference](.env.example)
- [User guide](https://guest.neweast.cloud/guide)
- [Intranet parking API](docs/NEWEAST-Intranet-Parking-API.pdf)

## Contributing

1. Branch from `main`.
2. Run `npm run check` and `npm run build` before opening a pull request.
3. Do not commit `.env`, database files, `data/`, logs, or visitor documents.
4. Keep labels on the screens in English.

See [CONTRIBUTING.md](CONTRIBUTING.md).
