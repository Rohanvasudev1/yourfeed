# 6. Free models: Groq's gpt-oss-20b by default, Ollama offline, rules last

Date: 2026-11-18 · Status: accepted (amends ADR 0004)

## Context
ADR 0004 picked any OpenAI-compatible API with Groq's free tier as the default, but didn't name a model or the limits. The owner won't pay for API credits and wants an open model. The owner's machine is an Apple M2 with 8 GB of RAM: gpt-oss-20b needs about 16 GB to run locally and qwen3:8b would barely fit, so a local model has to be small. Free-tier quotas change often.

## Decision
- **Default (development and the hosted demo):** Groq's free tier with `openai/gpt-oss-20b`, an open-weight model with tool calling. Setting it up is a free key in `AI_API_KEY`; nothing to install.
- **Offline option:** Ollama's OpenAI-compatible endpoint with `qwen3:4b` (small enough for 8 GB; weaker at tool calling). It's documented, not required.
- **Fallback:** the mockup's keyword rules answer whenever no model is set up, the provider errors, a call takes over 15 seconds, or an AI limit is reached. The demo never breaks.
- **AI limits**, kept in memory on the backend and set in config: per visitor IP about 10 requests a minute and 100 a day, plus one site-wide daily cap kept below the provider's free quota. Requests and note questions are at most 300 characters. Past a limit, the rules answer and the user sees one quiet line.
- The backend depends on one `Assistant` interface with three versions: the OpenAI-compatible model, the keyword rules, and a scripted fake for tests. Tests never call a real model; an optional eval script does, outside CI.
- The UI keeps the mockup's "Claude" wording; the account menu names the model actually answering, and a **provider notice** says requests and note questions go to that provider.

## Consequences
- In-memory limits reset when the server restarts and don't share across instances. That's fine for one small demo instance; move them to the database if it ever scales out.
- Quality differs by model: the rules and the fake keep behaviour testable, and the backend validates every feed action, so a weak model can at worst do nothing.
