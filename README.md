# Yourfeed

What if you chose your YouTube feed instead of the recommendation engine choosing it for you? Yourfeed is an open-source design exploration of YouTube's custom-feeds idea that you can also actually use: every tab is a feed you control, the controls sit inside the feed instead of in a settings page, and an AI turns plain language into settings you can see and undo.

> Not affiliated with YouTube or Google.

**Status:** early. The original clickable mockup is in [`prototype/index.html`](prototype/index.html) and is being ported. See [PROJECT.md](PROJECT.md) for the design and research, [CONTEXT.md](CONTEXT.md) for the vocabulary, and [docs/adr](docs/adr) for decisions.

## Run it locally

Demo mode needs no keys.

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173.

## Tests

```bash
cd backend && uv run pytest
```

```bash
cd frontend && npm test
```

Frontend coverage, measured through the whole-app tests and the `composeFeed` unit tests. It fails if statements, branches, functions or lines drop below 80% (the gate is `COVERAGE_MIN` in `frontend/vite.config.ts`); the HTML report lands in `frontend/coverage/`:

```bash
cd frontend && npm run coverage
```

End-to-end smoke test with Playwright. It starts the real backend (port 8010) and the app (port 5183) itself, then loads the app, opens Most viewed from Explore, changes the video length range, reloads and checks the change was kept. It needs `uv` on your path; the first time, install the browser:

```bash
cd frontend && npx playwright install chromium
```

```bash
cd frontend && npm run e2e
```

## Layout

- `backend/`: FastAPI. Catalogs (demo and YouTube), persistence, OAuth, AI.
- `frontend/`: Vite + React + TypeScript. `src/domain/compose.ts` turns a catalog plus a feed's settings into Up next.
- `prototype/`: the original single-file mockup, kept as the design reference.

## License

MIT
