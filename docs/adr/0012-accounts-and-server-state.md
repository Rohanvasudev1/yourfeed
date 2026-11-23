# 12. Accounts: Google sign-in, server state behind the storage port

Date: 2026-11-23 · Status: accepted (extends [ADR 0005](0005-youtube-via-google-oauth.md))

## Decision
- "Sign in with Google" asks for `youtube.readonly`; the hosted app stays in testing mode (100 named test users). Demo mode stays the default for everyone else.
- Server session: an httpOnly, SameSite=Lax cookie; writes need a CSRF token. Google refresh tokens are encrypted at rest with a key from the environment; nothing from Google reaches the browser.
- Signed-in state (feeds with their recipe logs, sessions, saved folders, history, notes, channel topics, inbox, blends) is stored in the database behind the same `StateStorage` port the browser uses, validated on load like browser state. SQLModel + Alembic; SQLite locally, Postgres (Neon free tier) when hosted.
- YouTube data is refreshed or deleted within 30 days. **Delete my data** removes the account and everything in it and revokes the Google token (well inside the 7-day rule).
- First sign-in offers **Bring your demo feeds** once: it copies recipes (names, ranges, and the topics that exist in the real catalog), nothing else.
- Free tiers only: backend on Render, frontend as static hosting.
