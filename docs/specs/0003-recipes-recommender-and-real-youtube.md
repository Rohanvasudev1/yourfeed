---
title: Follow-ups, a recipe-first recommender, and real YouTube
labels: [ready-for-agent]
status: open
date: 2026-11-23
---

## Problem Statement

Yourfeed matches the prototype, but only in demo mode. Three gaps keep it from being the design argument it set out to be:

- **The Claude bar forgets.** Every request stands alone, so "more like that" or "no, shorter" fails. A chat panel isn't the answer: it would break one-undo-per-request (ADR 0007), blow Groq's free budget, and make text, not the feed, the answer.
- **There's no recommender worth the name.** Everything ranks by watched topics and channels plus `log10(views)`, the most gameable signal there is, and nothing explains why a video is where it is. Behaviour (what you Finish, remove, pin) is either ignored or would silently drift the feed away from what you said you wanted.
- **There's no real YouTube.** No sign-in, no real catalog, no server state, and every "other person" is simulated.

## Solution

- **Follow-ups through a recipe log** (ADR 0009). Each feed keeps a short log of the requests that shaped it; the last three live lines go with each request so follow-ups work. Each request is still one undo step, and undo greys its log line out.
- **A recipe-first recommender** (ADR 0010). A `Ranker` scores only the user's own catalog from the recipe, the user's Yourfeed behaviour, recency and channel, never views, and gives every card a reason. Behaviour never changes the ranking by itself: the **recipe mirror** proposes recipe changes the user accepts or dismisses. One labelled **Outside your recipe** video per session keeps exploration in on purpose.
- **Real YouTube, by the book** (ADRs 0011–0013). Google sign-in with `youtube.readonly`; a catalog from the documented Data API only, with uploads and topic searches cached once and shared across users; topics from YouTube's own categories plus channel topics the user sets; state on the server behind the same storage port; real share links, sending and Blend at the recipe level; Delete my data.
- **Going live and telling the story** (ADR 0014). A setup wizard and runbook for the owner's hosting checkpoint, and a showcase page (`/about`) that argues the design case with live pieces of the demo.

Everything new also works in demo mode on the mock catalog (ADR 0001).

## User Stories

### Follow-ups and the recipe log
1. As a visitor, I want "more like that" or "no, shorter" to build on my last request on this feed, so that I can refine a feed in steps.
2. As a visitor, I want each feed to show a recipe log of the requests that shaped it (what I asked, what changed, any reply), so that I can see how the feed got here.
3. As a visitor, I want undoing a request to grey out its log line and redo to restore it, so that the log always matches the feed.
4. As a visitor, I want greyed-out lines to be ignored by follow-ups, so that an undone request doesn't steer the next one.
5. As a visitor, I want my answers on a question card to appear in the log, so that the feed's history is complete.
6. As a visitor, I want to clear a feed's log, so that I can start the conversation about it fresh without changing the feed.
7. As a visitor, I want each feed's log to be its own and to survive a reload, so that switching tabs never mixes them up.
8. As a visitor, I want follow-ups to keep working the same way when the simple rules answer (they just ignore the log), so that nothing breaks when AI is busy.
9. As someone running the hosted demo, I want a request with follow-ups to stay near 1,500 tokens, so that the free Groq tier still serves about 5 requests a minute.

### Ranker and reasons
10. As a visitor, I want Everything ranked by my recipe, what I've Finished, pinned and removed, recency and channel, and never by view counts, so that popularity can't buy a place in my feed.
11. As a visitor, I want every card to say why it's there ("Because you Finished 3 Cooking videos", "New from a channel you follow"), so that the feed explains itself.
12. As a visitor, I want "why is this first?" in the Claude bar to give the same reason the card shows, so that the two never disagree.
13. As a visitor, I want Most viewed to keep ranking by views, so that the one feed about popularity stays honest about it.
14. As a visitor, I want the same catalog, feed and seed to always give the same Up next, so that the feed is predictable.

### Recipe mirror
15. As a visitor, I want a card proposing a change when my behaviour on a feed keeps disagreeing with its recipe ("You Finished three 90-minute videos, but this feed is 10–60 min. Widen it?"), so that my feed keeps up with me without changing behind my back.
16. As a visitor, I want a proposal only after at least 3 signals in the last 14 days, so that one odd evening doesn't trigger it.
17. As a visitor, I want accepting a proposal to change the recipe as one undo step, so that I can take it back.
18. As a visitor, I want dismissing a proposal to hide it for 7 days, so that it doesn't nag.
19. As a visitor, I want at most one proposal per feed per visit, so that the feed isn't covered in cards.
20. As a visitor, I want the mirror to cover length (Finished outside the range), topics (a topic I keep removing) and mutes (pins from a muted topic), so that it catches the common mismatches.

### Outside your recipe
21. As a visitor, I want one video per session from topics next to my feed's, labelled "Outside your recipe", so that my feed doesn't wall me in.
22. As a visitor, I want to turn that slot off per feed, so that a focused feed stays focused.
23. As a visitor, I want the slot to count toward the session range like any video, so that my time plan holds.

### Sign-in and accounts
24. As a visitor, I want "Sign in with Google" in the account menu, so that I can use my real YouTube.
25. As a visitor, I want to be told what signing in reads (subscriptions, likes, playlists; read-only) and that the app is in testing mode, so that the "unverified app" warning doesn't surprise me.
26. As a new user, I want to pick a username at first sign-in, with the same rules as Share's username checks, so that people can send me feeds.
27. As a new user, I want a one-time "Bring your demo feeds" offer that copies my demo feed recipes, so that I don't rebuild them.
28. As a signed-in user, I want my feeds, sessions, saved folders, history, notes, recipe logs, channel topics, inbox and blends kept on the server, so that they follow me between devices.
29. As a signed-in user, I want to sign out and return to demo mode, so that I can show the demo without my account.
30. As a signed-in user, I want Delete my data in the account menu, with a confirmation, to remove everything and revoke Google's access, so that leaving is complete.
31. As a signed-in user, I want the account menu to show my username and "Signed in with Google", so that I know which mode I'm in.

### The real catalog
32. As a signed-in user, I want my feeds built from my subscriptions' recent uploads, so that the feed is my YouTube.
33. As a signed-in user, I want each video's topic from YouTube's own categories in readable words, so that topics work without AI tagging.
34. As a signed-in user, I want to set a channel's topic from a card's channel popup, so that a miscategorised channel lands in the right feed.
35. As a signed-in user, I want a feed's topics outside my subscriptions to bring in videos from a topic search, so that a new feed isn't empty.
36. As a signed-in user, I want a quiet message when today's topic searches are used up ("New topic searches resume tomorrow."), so that I know why a new topic is thin.
37. As a signed-in user, I want Hide clickbait and Honest titles to say "Demo catalog only", so that I know why they're off.
38. As a signed-in user, I want a clear message and a retry when YouTube can't be reached or my access expired, so that I'm never stuck on a blank feed.
39. As someone running the hosted app, I want uploads and topic searches cached once and shared across users, refreshed at most every 6 hours and never kept past 30 days, so that 100 test users fit in the daily quota and the terms.

### Other people, for real
40. As a signed-in user, I want share links with real videos to open for anyone, signed in or not, so that sharing works across catalogs.
41. As a signed-in user, I want to send a feed to a username and have it land in their Shared with you, so that sending is real.
42. As a signed-in user, I want sending to an unknown username to say "No one has that username.", so that I know it didn't go.
43. As a signed-in user, I want to blend with another signed-in user, who approves in their own account, so that a Blend is real.
44. As a signed-in user, I want a blend to mix our recipes, each applied to our own catalog, so that neither of us sees the other's subscriptions.
45. As a signed-in user, I want From Claude to stay labelled "Demo only", so that I know it's still simulated.

### Going live
46. As the owner, I want one step-by-step script that walks me through Google Cloud, the OAuth consent screen, test users, the API key, Neon and Render, so that I can put the app online without hunting through dashboards.
47. As someone self-hosting, I want a README runbook and `.env.example` entries for every new variable, so that I can run my own instance.
48. As the owner, I want a manual smoke script that checks a real Google account end to end, outside CI, so that I can confirm the real API works before going live.

### Showcase page
49. As a visitor, I want an `/about` page that explains the idea (the recipe is a contract, the mirror proposes, outside your recipe, personalised by what you say rather than by profiling), so that the design argument is readable in one place.
50. As a visitor, I want live, working pieces of the demo on that page (a recipe being edited by a request, a mirror proposal, a reasoned card), so that the argument is shown, not just told.
51. As a visitor, I want a link from the app to the page and back, so that I can find it.

### Throughout
52. As a keyboard or screen-reader user, I want the recipe log, reasons, mirror card, outside-your-recipe label, sign-in flow, username picker, channel-topic popup and showcase page to be reachable and named, so that the new parts work without a mouse.
53. As a visitor, I want the new parts to stay quiet except for errors, no-ops, results I can't see and direct answers (spec #1 story 67), so that the app still never nags.
54. As a visitor, I want the demo to keep working with no setup, no sign-in and no keys, so that anyone can try it.

## Implementation Decisions

- **Respects ADRs 0001–0014.** New: 0009 (follow-ups, recipe log), 0010 (Ranker, recipe mirror, outside your recipe), 0011 (documented YouTube API, shared caches, topics), 0012 (accounts, server state), 0013 (real people at recipe level), 0014 (hosting wizard, showcase page). Composition stays in the frontend (0003).
- **Recipe log** is part of each feed's persisted state: `{ id, request, summary, reply?, live }[]`, at most 20. The request reducer appends a line in the same action that records the undo step; undo and redo flip `live`. The assistant request body gains `followUps: { request, summary }[]` (≤ 3, live only); the Up next context shrinks from 20 to 15 videos. The backend validates and caps it and puts it in the prompt; the rules ignore it. The eval script gains follow-up cases.
- **Ranker** is a pure frontend module: `rank(candidates, feed, behaviour, now) => { video, score, reason }[]`. `composeFeed` calls it for Everything, topics feeds, From Claude and Blend; Most viewed, Subscriptions, News and Shared keep their own orders. Reasons are short typed values (`finishedTopic`, `pinnedChannel`, `newFromSubscription`, `matchesTopic`, `outsideRecipe`…) rendered by the card; the assistant's feed context carries the first video's reason (ADR 0006). Same inputs, same output.
- **Behaviour** is derived from existing state (Finished, removed, pinned, watched, notes) plus a new **skipped** record (a video shown in Up next and passed over when the session ended), each timestamped. Kept per feed, trimmed to 30 days.
- **Recipe mirror** is a pure function `mirror(feed, behaviour, now) => Proposal | null` with a fixed rule table (length, topic, mute); a proposal carries the feed actions it would apply and is applied through the same one-step path as a request. Dismissals are stored per feed with their date.
- **Outside your recipe**: `adjacentTopics(feed, catalog)` picks topics that co-occur with the feed's on the same channels; one video from them is placed in Up next and labelled; per-feed `exploreSlot: boolean`, default on.
- **Backend persistence**: SQLModel + Alembic, SQLite locally and in tests, Postgres when hosted. Tables: users (Google subject, username, encrypted refresh token), user state (one validated JSON document per user, versioned like browser storage), channel cache, topic search cache, inbox items, blend invites. `GET/PUT /api/state` behind the session; the frontend picks the server `StateStorage` when signed in.
- **Auth**: `/api/auth/login` → Google → `/api/auth/callback`; an httpOnly SameSite=Lax session cookie; a CSRF token on every write; `POST /api/auth/logout`; `DELETE /api/account` deletes rows and revokes the token. Google's OAuth endpoints sit behind an interface with a fake for tests. Secrets (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_API_KEY`, `SESSION_SECRET`, `TOKEN_ENCRYPTION_KEY`, `DATABASE_URL`) come from the environment and are checked at startup when signed-in mode is enabled; without them the app runs demo-only.
- **YouTubeClient** interface (`subscriptions`, `uploads(channel)`, `videos(ids)`, `search(topic)`) with an HTTP version and a recorded-fixture fake. The catalog service assembles a signed-in user's catalog from subscriptions + shared channel cache + shared topic cache, maps `topicCategories` to the fixed topic list (video first, then channel), applies channel topics, and returns the existing `Video` shape (clickbait off, honest title empty). Cache rows carry `fetched_at`; reads refresh past 6 hours; a daily job (or lazy check) deletes rows past 30 days. A per-project counter enforces the 100 searches a day.
- **People**: usernames are unique and checked with the existing username rules; sending writes an inbox item for the recipient; Blend invites are rows with pending/accepted; a blend stores both recipes' topics, never catalog rows. Share links decode as today; in signed-in mode unknown ids are resolved through `videos.list`.
- **Hosting**: `render.yaml` (backend web service + static frontend), `scripts/setup-hosting` built as an interactive step-by-step wizard, a README runbook section, `.env.example` entries, `scripts/youtube_smoke.py`.
- **Showcase page**: a route in the same frontend (`/about`), reusing real components against the demo catalog and an in-memory store, so it can't drift from the app. Content from the ADRs; no new claims beyond them.
- **Files stay small**, as in spec 2: one component per area and one backend module per concern (auth, state, youtube client, catalog service, caches, people).

## Testing Decisions

- **Good tests check behaviour a visitor or an API client can see**, never internals, prompts, SQL or the rules' tables.
- **Seam 1 (existing, main): the whole app** with an injected catalog, in-memory storage and the scripted assistant port. New: follow-ups send the live log lines and undo greys one out; reasons on cards; a mirror proposal appears after scripted behaviour, accept is one undo, dismiss hides it; the outside-your-recipe card and its toggle; signed-in mode via an injected fake account port (menu, username, Bring your demo feeds, demo-only filters, channel topic, Delete my data confirmation).
- **Seam 2 (existing): pure domain functions.** `composeFeed`'s tests are prior art. New: `rank` (no views, determinism, reasons), `mirror` (each rule, the 3-signal and 14-day thresholds, dismissal), `adjacentTopics`, the recipe log's undo and cap.
- **Seam 3 (existing): the backend API through FastAPI's test client** on SQLite, with the fake Google and fake `YouTubeClient`, never the network. New: sign-in callback creates a user and a cookie; CSRF rejected writes; state round trip and validation; Delete my data removes rows and calls revoke; catalog assembly with topic mapping and channel topics; cache sharing across two users, 6-hour refresh, 30-day expiry, search budget; send to username and unknown username; Blend invite and accept; follow-ups validated and capped. The assistant API tests are prior art.
- **Seam 4 (existing): Playwright smoke**, extended: a follow-up request in demo mode shows a log line and undo greys it; the `/about` page renders its live pieces.
- **Manual scripts** (not CI): `scripts/youtube_smoke.py` against a real account; the eval script's follow-up cases against a real model.
- **Coverage** stays at 80%+ on the frontend and on the backend's assistant modules; new backend modules (auth, state, youtube, people) join the backend coverage gate at 80%.

## Out of Scope

- A full conversation panel, streaming, or chat history beyond the recipe log.
- Training or running learned recommender models; the feed lab (`research/`) stays a separate track and can implement `Ranker` later.
- Storing per-video AI tags (topic, clickbait, honest title) or embeddings for YouTube API Data; Hide clickbait and Honest titles on the real catalog.
- Channel RSS feeds or any non-API access to YouTube.
- Using YouTube watch history (not available) or YouTube's own recommendations.
- A real Claude connection for From Claude.
- Google app verification and leaving testing mode (more than 100 users).
- Restyling the app itself; the showcase is a separate page.
- Paid hosting, paid models or anything that needs credits.
- Actually deploying: that's the owner's checkpoint with the wizard.

## Further Notes

- Policy readings (derived data, shared caches of non-authorized data, RSS) follow `research/background.md` §5 in the feed-lab worktree and are our reading, not legal advice.
- Quota math: shared per-channel caches make 100 test users fit in 10,000 units a day; `search.list` is 100 calls a day for the whole project, so topic searches are cached per topic and shared.
- The owner's machine has 8 GB of RAM; nothing here needs a local model.
