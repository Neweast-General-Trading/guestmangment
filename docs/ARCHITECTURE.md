# Architecture

NEWEAST Guest Management is a **Next.js App Router** application. One Node process serves
the English web UI, server actions, and REST routes.

## Runtime

```
┌────────────────────┐  HTTPS   ┌───────────┐   reverse proxy    ┌──────────────────────────┐
│  Browser / kiosk   │ ───────▶ │   nginx   │ ─────────────────▶ │  Next.js (PM2)           │
│  Intranet portal   │ ◀─────── │ TLS + gz  │                    │  guest-visit · port 3088 │
└────────────────────┘          └───────────┘                    └─────────────┬────────────┘
                                                                               │ Prisma
              ┌──────────────────────────────┬─────────────────┬───────────────┴────────────┐
              ▼                              ▼                 ▼                            ▼
        SQLite (prisma/dev.db)      Microsoft Graph     IMAP + SMTP              SQL Server / HANA
        visits, rooms, parking      HQ room calendars   guest@ mailbox           payroll / intranet SSO
```

- Sessions are JWT cookies (`neweast_session`, 14 days) signed with `AUTH_SECRET`.
- `src/proxy.ts` protects private routes and forwards intranet SSO query parameters to `/sso`.
- Public paths: `/login`, `/sso`, `/invite`, `/guide`, `/display`, `/api/display`, `/api/intranet`.

## Domains

| Area | Location | Notes |
| --- | --- | --- |
| Visit lifecycle | `src/lib/visits.ts`, `src/lib/approvals.ts` | Requests, approvals, invitations, status |
| Rooms | `src/lib/room-booking.ts`, `src/lib/graph.ts` | Holds in SQLite + Outlook calendars |
| Mail | `src/lib/mail.ts`, `src/lib/inbox-sync.ts` | SMTP outbound, IMAP intake |
| Parking | `src/lib/parking.ts`, `src/lib/parking-assign.ts` | Guest and staff bays |
| Tracking | `src/lib/tracking.ts` | All-staff analysis, filters, pagination |
| Access | `src/lib/access.ts`, `src/lib/permissions.ts` | Roles, nav, tracking allow-list |
| Displays | `src/lib/display.ts` | Lobby / floor kiosk screens |
| Intranet | `src/lib/intranet-sso.ts`, `src/app/api/intranet` | SSO and parking lookup |

## Data

Prisma schema: [`prisma/schema.prisma`](../prisma/schema.prisma).

Production uses SQLite at `prisma/dev.db`. Schema updates are `npx prisma db push`.
**Do not seed** a live database — `prisma/seed.ts` deletes visits.

## Integrations

- **Microsoft Graph** — list HQ rooms, book/cancel holds, getSchedule for tracking.
- **Guest mailbox** — IMAP for visit-request mail and room accept/decline.
- **SMTP** — invitations, notices, BCC to operations.
- **SQL Server** — optional payroll employee lookup.
- **SAP HANA** — optional intranet SSO identity.
- **Teams** — optional webhook / API notices.
- **Intranet parking API** — `GET/POST /api/intranet/parking` with `INTRANET_API_KEY`.
