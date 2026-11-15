# 2. FastAPI backend, Vite + React + TypeScript frontend

Date: 2026-11-15 · Status: accepted

## Decision
- **Backend:** Python 3.12, FastAPI, SQLModel and Alembic, managed with `uv`, tested with pytest. SQLite locally, Postgres when hosted (e.g. Neon). Deployed on Render or Fly.
- **Frontend:** Vite + React + TypeScript, tested with Vitest (logic) and Playwright (main flows). Static hosting.
- Monorepo: `backend/`, `frontend/`, `docs/`, `prototype/`.

## Why
The owner wants a Python backend. With FastAPI serving the API, a Next.js server would sit unused, so a plain SPA is simpler.
