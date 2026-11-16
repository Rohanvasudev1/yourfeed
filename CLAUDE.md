# Yourfeed

Read `CONTEXT.md` for the vocabulary and `docs/adr/` for decisions before changing code. Work is tracked as GitHub issues: spec #1, tickets #2–#14 (each lists what blocks it).

## Commands

- Backend tests: `cd backend && uv run pytest`
- Frontend tests: `cd frontend && npm test`, typecheck: `cd frontend && npx tsc -b`
- Frontend coverage gate (80%): `cd frontend && npm run coverage`; Playwright smoke: `cd frontend && npm run e2e`

## Worktrees

Delete worktrees as soon as their work is finished:

- After a ticket's pull request merges or closes, run `scripts/clean-worktrees.sh` from the main checkout. It removes worktrees whose pull request is merged or closed and their local branches, and never touches one with uncommitted changes.
- Run it with `--dry-run` first if anything looks unexpected.
- Don't create a worktree for read-only work.
