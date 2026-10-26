# Contributing

## Workflow

1. Branch from `main`: `git checkout -b feature/short-description`.
2. Make focused commits using [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
3. Before pushing run:
   ```bash
   npm run lint
   npm run check
   npm run build
   ```
4. Open a pull request describing **what** changed and **why**, with screenshots for UI work.

## Code style

- TypeScript everywhere; avoid `any` unless unavoidable.
- Next.js App Router: pages in `src/app`, reusable UI in `src/components`, domain logic in `src/lib`.
- Keep server and client boundaries clean. Do not pass functions from Server Components into Client Components.
- User-facing text is English.
- After application code changes on the production host, run:
  ```bash
  npx prisma generate && npm run build && pm2 restart guest-visit --update-env && pm2 save
  ```
- Never wipe live visits. Do not run `npm run db:prepare` or `prisma db seed` against HQ data.

## Never commit

- `.env` files, API keys, passwords, tokens, certificates
- SQLite databases (`prisma/dev.db`, `*.db`)
- Uploaded visitor photos (`data/`, `public/uploads/`)
- GitHub personal access tokens

If a secret is committed by mistake, rotate it immediately — removing it from history is
not enough.
