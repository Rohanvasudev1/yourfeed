# Yourfeed

What if you chose your YouTube feed instead of the recommendation engine choosing it for you? Yourfeed is an open-source design exploration of YouTube's custom-feeds idea that you can also actually use: every tab is a feed you control, the controls sit inside the feed instead of in a settings page, and an AI turns plain language into settings you can see and undo.

> Not affiliated with YouTube or Google.

**Status:** demo mode covers everything the original clickable mockup did, so [`prototype/index.html`](prototype/index.html) is retired and kept only as a historical reference. On top of it, the Claude bar takes follow-ups through each feed's recipe log, a recipe-first Ranker explains every card, the recipe mirror proposes changes instead of making them, and signing in with Google turns on a real YouTube catalog, server state, sharing and Blend. The showcase page at `/about` argues the design with live pieces of the demo. See [PROJECT.md](PROJECT.md) for the design and research, [CONTEXT.md](CONTEXT.md) for the vocabulary, and [docs/adr](docs/adr) for decisions.

## How it works

- **Every tab is a feed, and a feed is a recipe**: topics or channels, a video length range, a session range and mutes. Only you, or an undoable change you asked for or accepted, change it.
- **The Claude bar** turns a request ("add cooking, nothing over 20 minutes") into feed changes you can see and undo, one undo step per request ([ADR 0007](docs/adr/0007-assistant-changes-only-the-current-feed.md)).
- **The recipe log** under the bar lists the requests that shaped the feed. The last three live lines go with the next request, so "no, shorter" or "more like that" work; undo greys a line out and Clear log empties it ([ADR 0009](docs/adr/0009-follow-ups-and-recipe-log.md)).
- **The Ranker** orders your own catalog by the recipe, what you did here (Finished, watched, pinned, removed, skipped, notes you wrote), recency and channels you follow, never by views outside Most viewed, and every card says why it's there ([ADR 0010](docs/adr/0010-recommender-ranks-your-catalog-and-proposes.md)).
- **The recipe mirror** proposes a recipe change when at least 3 signals in 14 days disagree with it (say, three Finished videos longer than the feed allows). Accept is one undo step with a log line; Dismiss hides it for 7 days; at most one per feed per visit.
- **Outside your recipe** puts one labelled video from neighbouring topics in each session; turn it off per feed.

Everything works in demo mode on the mock catalog with no sign-in or keys.

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

Signed in, a new account picks a username, then starts with the built-in feeds only (Everything, Subscriptions, Most viewed, News, From Claude, Blend, Shared with you), built from your subscriptions' recent uploads. None of the demo's made-up feeds, shares, blends or history come along: if this browser has a saved demo, **Bring your demo feeds** offers once to copy your demo feeds' recipes. Feeds, sessions, notes, recipe logs, behaviour, channel topics, inbox and blends live on the server (`GET/PUT /api/state`), so they follow you between devices. Reset demo is only in demo mode; signed in, Delete my data is the way to start over. Sign out returns to the browser's demo, untouched.

## Host it (free tiers)

Going live is the owner's job (ADR 0014): only you can create the Google Cloud project, the Neon and Render accounts, and the secrets. Everything else runs locally with the YouTube fake and SQLite. The hosted app is the [`render.yaml`](render.yaml) Blueprint: the backend as a free Render web service (`yourfeed-api`) and the frontend as a free static site (`yourfeed`) that rewrites `/api/*` to the backend, so the browser only ever talks to one origin and the session cookie stays first-party. The database is Neon's free Postgres.

Run the wizard. It opens each page, says what to click, and saves what you paste to `backend/.env.hosting` (git-ignored, readable only by you); it never prints a secret back and a re-run keeps what's saved:

```bash
scripts/setup-hosting
```

Its stages, so you can also do them by hand:

1. **Google Cloud project**, with **YouTube Data API v3** enabled.
2. **OAuth consent screen**: External, publishing status **Testing**, scope `youtube.readonly`, and every person who will sign in added as a **test user** (at most 100; ADR 0012).
3. **OAuth client** (Web application) with two redirect URIs: `https://yourfeed.onrender.com/api/auth/callback` (your `APP_URL` plus `/api/auth/callback`) and `http://localhost:5173/api/auth/callback`. Gives `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. **API key**, restricted to YouTube Data API v3: `YOUTUBE_API_KEY`.
5. **`SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY`**, made locally (`.env.example` says how). Keep the encryption key: a new one makes every stored sign-in unreadable.
6. **Neon** project (AWS US West, Oregon) and its connection string with **pooling off**: `DATABASE_URL`. Then create the tables:

   ```bash
   cd backend && uv run --env-file .env.hosting alembic upgrade head
   ```

   The backend also migrates at startup, so this is a check that the database is reachable. `DATABASE_URL` may start `postgres://` or `postgresql://`.
7. **Groq key** (optional): `AI_API_KEY`. Without it the Claude bar uses the keyword rules.
8. **Render**: New → Blueprint → this repo. Render asks once for each `sync: false` variable in `render.yaml`: `APP_URL`, the five sign-in secrets, `DATABASE_URL` and `AI_API_KEY`. Apply, and wait until both services are Live.
9. **Check the addresses.** If Render gave the site another address than `https://yourfeed.onrender.com`, set `APP_URL` on `yourfeed-api` and the OAuth client's redirect URI to it. If the backend isn't at `https://yourfeed-api.onrender.com`, change the `/api/*` rewrite's `destination` in `render.yaml` and push. `APP_URL/api/health` should answer `{"success": true, ...}`.
10. **Sign in** on the site as a test user, pick a username, and run the YouTube smoke test below.

Free Render services sleep after 15 idle minutes, so the first visit after a while takes about a minute. Render's proxy sets `X-Forwarded-For`, which the backend trusts (`--forwarded-allow-ips '*'`) so AI limits are per visitor; a visitor can forge that header to get a fresh per-visitor limit, but the site-wide daily cap still holds.

### YouTube smoke test (manual)

`backend/scripts/youtube_smoke.py` checks one real signed-in account end to end against the real Google and YouTube APIs: the stored grant, a fresh access token, subscriptions, the catalog, topics and a video lookup. It reads the backend's variables, never prints a token, only reads the database (uploads go to a throwaway cache, not the shared one) and uses a few quota units and no searches. Because it calls real APIs it never runs in CI or pytest; only its checks are tested, against the fakes. Sign in and pick a username first, then:

```bash
cd backend && uv run --env-file .env.hosting python -m scripts.youtube_smoke --username yourname
```

Locally, after signing in at http://localhost:5173, use `--env-file .env` instead.

## Tests

```bash
cd backend && uv run pytest
```

Backend coverage on the assistant, accounts and sign-in, server state, YouTube catalog and caches, sharing and Blend modules, measured through the API tests with the fake Google and fake YouTube client. It fails below 80% (`fail_under` in `backend/pyproject.toml`):

```bash
cd backend && uv run pytest --cov=app.assistant --cov=app.accounts --cov=app.youtube --cov=app.user_state --cov=app.sharing --cov=app.blends
```

```bash
cd frontend && npm test
```

Frontend coverage, measured through the whole-app tests and the `composeFeed` unit tests. It fails if statements, branches, functions or lines drop below 80% (the gate is `COVERAGE_MIN` in `frontend/vite.config.ts`); the HTML report lands in `frontend/coverage/`:

```bash
cd frontend && npm run coverage
```

End-to-end smoke test with Playwright. It starts the real backend (port 8010, with no AI key so the keyword rules answer) and the app (port 5183) itself, then runs four demo-mode flows: a length range set on an Explore feed survives a reload; "add cooking" from the Claude bar on Learn adds Cooking and undo takes it back; a request and a follow-up add recipe log lines, undo greys the follow-up out and Clear log empties the log; and `/about` renders its live pieces and links to and from the app. It needs `uv` on your path; the first time, install the browser:

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
