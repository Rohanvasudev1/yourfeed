# Yourfeed

What if you chose your YouTube feed instead of the recommendation engine choosing it for you? Yourfeed is an open-source design exploration of YouTube's custom-feeds idea that you can also actually use: every tab is a feed you control, the controls sit inside the feed instead of in a settings page, and an AI turns plain language into settings you can see and undo.

> Not affiliated with YouTube or Google.

**Status:** demo mode is complete: the React app covers everything the original clickable mockup did, so [`prototype/index.html`](prototype/index.html) is retired and kept only as a historical reference. See [PROJECT.md](PROJECT.md) for the design and research, [CONTEXT.md](CONTEXT.md) for the vocabulary, and [docs/adr](docs/adr) for decisions.

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

Nothing here needs a paid key. Three variables choose the model: `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` (see [ADR 0004](docs/adr/0004-provider-agnostic-ai.md) and [ADR 0006](docs/adr/0006-free-models-groq-and-ollama.md)). Keys stay on the backend and never reach the browser: the browser only talks to the backend's `/api/assistant/*` endpoints, and `GET /api/assistant/info` reports the model's name, never the key.

- **No key** (the default): leave all three empty. The Claude bar and Ask in notes answer with simple keyword rules ported from the mockup, so the demo always works.
- **Groq** (free tier, nothing to install): get a free key at console.groq.com and set only `AI_API_KEY`. The base URL defaults to Groq and the model to `openai/gpt-oss-20b`.
- **Ollama** (local, offline, no key): install Ollama, pull a model, then set `AI_BASE_URL=http://localhost:11434/v1` and `AI_MODEL` to it. `qwen3:4b` fits in 8 GB of RAM but is weaker at tool calling; `qwen3:8b` is better with 16 GB; `gpt-oss:20b` needs about 16 GB. Leave `AI_API_KEY` empty.
- **Anything else OpenAI-compatible**: set `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL`.

To set one up, copy [`.env.example`](.env.example) to `backend/.env`, fill in one option, and start the backend with the file. For Ollama, pull the model first:

```bash
ollama pull qwen3:4b
```

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8000 --env-file .env
```

If the model errors, takes over 15 seconds, or a visitor or the whole site passes its AI limit (`AI_LIMIT_PER_MINUTE`, `AI_LIMIT_PER_DAY`, `AI_LIMIT_SITE_PER_DAY`), the keyword rules answer and the bar says "Using simple rules for now. AI is busy." `GET /api/assistant/info` says which assistant is answering. Per-visitor limits key on the client IP: behind a reverse proxy, start uvicorn with `--proxy-headers --forwarded-allow-ips <proxy IP>` so each visitor gets their own limit.

To compare models, run a fixed set of requests against the one you set up. It calls the real model, so it isn't part of the tests or CI:

```bash
cd backend && uv run --env-file .env python -m scripts.eval_model
```

### Sign in with Google (optional)

Without these the app is demo-only, and the account menu says signing in isn't set up. To turn it on (see [ADR 0012](docs/adr/0012-accounts-and-server-state.md)):

1. In Google Cloud, create an OAuth client of type *Web application* with the authorized redirect URI `http://localhost:5173/api/auth/callback` (your `APP_URL` plus `/api/auth/callback` when hosted). Its consent screen stays in testing mode, so add each person who signs in as a test user; Google warns them that the app isn't verified.
2. In `backend/.env`, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` (`.env.example` says how to make the last two). Set any of them and the backend refuses to start until all four are set.
3. Start the backend with the file. It creates and migrates the database itself: SQLite in `backend/yourfeed.db` unless `DATABASE_URL` points at Postgres.

The session is an httpOnly, SameSite=Lax cookie, and sign out and Delete my data also need the session's CSRF token. Google refresh tokens are encrypted at rest and never reach the browser. Delete my data deletes the account's rows and revokes the token.

## Tests

```bash
cd backend && uv run pytest
```

Backend coverage on the assistant and accounts modules (`app/assistant`, `app/accounts`), measured through the API tests. It fails below 80% (`fail_under` in `backend/pyproject.toml`):

```bash
cd backend && uv run pytest --cov=app.assistant --cov=app.accounts
```

```bash
cd frontend && npm test
```

Frontend coverage, measured through the whole-app tests and the `composeFeed` unit tests. It fails if statements, branches, functions or lines drop below 80% (the gate is `COVERAGE_MIN` in `frontend/vite.config.ts`); the HTML report lands in `frontend/coverage/`:

```bash
cd frontend && npm run coverage
```

End-to-end smoke test with Playwright. It starts the real backend (port 8010, with no AI key so the keyword rules answer) and the app (port 5183) itself, then runs two flows: open Most viewed from Explore, change the video length range, reload and check the change was kept; and send "add cooking" from the Claude bar on Learn, see Cooking in the feed's topics, then undo it. It needs `uv` on your path; the first time, install the browser:

```bash
cd frontend && npx playwright install chromium
```

```bash
cd frontend && npm run e2e
```

## Layout

- `backend/`: FastAPI. Catalogs (demo and YouTube), persistence, OAuth, AI.
- `frontend/`: Vite + React + TypeScript. `src/domain/compose.ts` turns a catalog plus a feed's settings into Up next.
- `prototype/`: the original single-file mockup. Retired: the React app replaces it; kept as a historical reference.

## License

MIT
