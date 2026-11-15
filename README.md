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

## Layout

- `backend/`: FastAPI. Catalogs (demo and YouTube), persistence, OAuth, AI.
- `frontend/`: Vite + React + TypeScript. `src/domain/compose.ts` turns a catalog plus a feed's settings into Up next.
- `prototype/`: the original single-file mockup, kept as the design reference.

## License

MIT
