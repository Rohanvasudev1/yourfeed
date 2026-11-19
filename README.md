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

### AI for the Claude bar (optional, free)

With no AI set up, the Claude bar answers with simple keyword rules. To use a real model, copy [`.env.example`](.env.example) to `backend/.env`, fill in one of the options below, and start the backend with `--env-file .env`. The key stays on the backend; the browser never sees it.

- **Groq** (default, free tier, nothing to install): get a free key at console.groq.com and set `AI_API_KEY`. The model is `openai/gpt-oss-20b` unless you set `AI_MODEL`.
- **Ollama** (offline, no key): `ollama pull qwen3:4b`, then set `AI_BASE_URL=http://localhost:11434/v1` and `AI_MODEL=qwen3:4b`. Small enough for 8 GB of RAM, weaker at tool calling.
- **Anything else OpenAI-compatible**: set `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL`.

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000 --env-file .env
```

If the model errors, takes over 15 seconds, or a visitor or the whole site passes its AI limit (`AI_LIMIT_PER_MINUTE`, `AI_LIMIT_PER_DAY`, `AI_LIMIT_SITE_PER_DAY`), the keyword rules answer and the bar says "Using simple rules for now. AI is busy." `GET /api/assistant/info` says which assistant is answering. Per-visitor limits key on the client IP: behind a reverse proxy, start uvicorn with `--proxy-headers --forwarded-allow-ips <proxy IP>` so each visitor gets their own limit.

To compare models, run a fixed set of requests against the one you set up. It calls the real model, so it isn't part of the tests or CI:

```bash
cd backend && uv run --env-file .env python -m scripts.eval_model
```

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
