# 5. Connect YouTube with Google OAuth (youtube.readonly)

Date: 2026-11-15 · Status: accepted

## Decision
- "Sign in with Google" requests the `youtube.readonly` permission and reads subscriptions, liked videos and playlists.
- New uploads come from channel RSS feeds (`/feeds/videos.xml?channel_id=…`), which cost no quota. `videos.list` fills in durations and descriptions (1 unit per 50 videos). `search.list` costs 100 units, so results are cached.
- Watch history isn't available through the API (to be confirmed against the current reference). Yourfeed keeps its own history from Finished.
- No downloading videos and no scraping transcripts.

## Consequences
- Google treats `youtube.readonly` as sensitive. Until the app is verified, the hosted site runs in testing mode: at most 100 named test users, who see an "unverified app" warning. Verification is a later step.
- People who self-host create their own Google OAuth client. The README walks through it.
