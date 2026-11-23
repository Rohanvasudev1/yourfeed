# 11. The YouTube catalog uses the documented API only, with shared caches

Date: 2026-11-23 · Status: accepted (supersedes the RSS and quota parts of [ADR 0005](0005-youtube-via-google-oauth.md))

## Context
ADR 0005 relied on channel RSS feeds, which aren't part of the documented API (a gray area under Developer Policies III.I.14), and said a search costs 100 units; since June 2026 `search.list` has its own bucket of 100 calls a day per project. Stored AI tags of API Data (topic, clickbait, honest title) are "derived data" under III.E.4.h, and tagging thousands of videos would take Groq's free tier minutes per user anyway.

## Decision
- Everything goes through a backend `YouTubeClient` interface. Tests use a recorded-fixture fake; CI never calls Google. A manual `scripts/youtube_smoke.py` checks a real account.
- Subscriptions: `subscriptions.list` with the user's token (Authorized Data, kept per user).
- Uploads: `playlistItems.list` on each channel's uploads playlist **with the server's API key**, cached **per channel and shared across users**, refreshed at most every 6 hours when someone needs it, deleted or refreshed within 30 days (III.E.4.d).
- Details: `videos.list`, 50 ids per unit.
- `search.list` only for a feed's topics outside subscriptions, cached per topic and shared, within the 100-call daily budget; past it, no new searches until tomorrow.
- **Topics** come from YouTube's `topicCategories` (video, else channel), mapped to a fixed list of about 60 readable names. A topic the user sets for a channel is Yourfeed data, stored, and wins.
- In signed-in mode **Hide clickbait and Honest titles are demo-only**: the filters show "Demo catalog only". No per-video AI tags are stored for API Data.

## Consequences
- With 100 test users and shared channel caches, a day fits in the default 10,000 units.
- Yourfeed stays an audit-ready example of what a third-party recommender can do within the terms.
