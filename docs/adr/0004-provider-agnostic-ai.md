# 4. Provider-agnostic AI, free by default, with a keyword fallback

Date: 2026-11-15 · Status: accepted

## Context
The owner wants free AI. As of Nov 2026, DeepSeek's API is prepaid (cheap but not free). Groq and OpenRouter have free tiers that support tool calling. Gemini's free tier only covers Flash models since April 2026. The limits change often.

## Decision
- The backend talks to any **OpenAI-compatible** chat API, configured by `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL`. The default is Groq's free tier.
- The assistant returns **feed actions** through tool calling. The UI applies them and records an undo step.
- If no key is set, the provider errors, or the quota runs out, the mockup's keyword rules take over. The demo never breaks.
- The hosted demo rate-limits AI per visitor.
- Keys never reach the browser.
