# Security notes

## Secrets

Never commit `.env`, Graph client secrets, IMAP/SMTP passwords, SQL/HANA credentials,
intranet API keys, or GitHub personal access tokens.

If a token is pasted into chat, email, or a ticket, **revoke it and issue a new one**.
Deleting it from a transcript is not enough.

## Sessions

- Cookie `neweast_session` is httpOnly JWT, 14-day expiry, signed with `AUTH_SECRET`.
- Set a unique `AUTH_SECRET` in production. The fallback `dev-secret` is local-only.

## Access

- Role-based navigation is defined in `src/lib/permissions.ts`.
- Tracking analysis is an **email allow-list** in `src/lib/access.ts` (not every admin).
- Access administration (`/access`) is limited to full-access emails.
- Intranet parking API requires `INTRANET_API_KEY`.

## Public surfaces

These routes do not require a staff session:

- `/login`, `/sso`
- `/invite/[token]` — guest invitation
- `/display/[token]` — kiosk screens
- `/guide` — user guide assets
- `/api/intranet/*` — key-authenticated intranet API
- `/api/display/media/*` — kiosk media

All other pages redirect to login (`src/proxy.ts`).

## Data at rest

- Visitor photos live under `data/` and `public/uploads/` (git-ignored).
- The SQLite file holds visits, guests, and audit logs. Restrict filesystem permissions
  to the service account.
- Do not copy production `dev.db` into git, tickets, or laptops without approval.

## Mail and Graph

Graph app permissions should be the minimum needed to read HQ room calendars and
create/cancel events on the guest mailbox. Store tenant, client id, and client secret
only in `.env`.
