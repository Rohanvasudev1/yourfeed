---
title: Feed experience in demo mode (port the mockup to React)
labels: [ready-for-agent]
status: open
date: 2026-11-15
---

## Problem Statement

The Yourfeed design only exists as a single-file mockup (`prototype/index.html`, about 1,370 lines) that forgets everything on reload, can't be tested, and can't grow into the real product. The new React app pulls the demo catalog from the backend and composes a feed, but it only shows a bare list. A visitor can't do anything the design is about: switch feeds, tune a feed from the settings line, watch through a session, or take notes.

## Solution

Rebuild the mockup's core feed experience in the React app, in **demo mode** (no sign-in, the mock catalog from the backend, state kept in the visitor's browser). A visitor gets the tab bar with Home and Explore, their own feeds, the settings line with its popups, grid and list cards with YouTube-style thumbnails, global filters, the Finished / Watching now / Up next session flow, notes on every video and every feed, the logo refresh, and undo/redo. All of this stays put across reloads. It should look and behave like the mockup, with one difference: state is now saved.

## User Stories

### Tabs and feeds
1. As a visitor, I want the app to open on Everything (shown as a home icon), so that I start from a familiar home feed.
2. As a visitor, I want the built-in feeds other than Home (Subscriptions, Most viewed, News) grouped under one Explore button, so that the tab bar stays short.
3. As a visitor, I want the Explore menu to show each built-in feed's icon, a one-line description and a check on the current one, so that I know what each feed does before opening it.
4. As a visitor, I want the Explore button to show the open built-in feed's name and icon, so that I can tell where I am.
5. As a visitor, I want my own feeds (Learn, Sport and any I make) as tabs in the bar, so that switching between them takes one click.
6. As a visitor, I want a + button that creates a draft feed with a "Name this feed" box, so that I can start a feed of my own.
7. As a visitor, I want an unused draft to disappear when I leave it, so that empty feeds don't pile up.
8. As a visitor, I want feed names to be unique and not to match a built-in feed in any capitalisation, so that tabs are never confused ("News" is rejected, with the message "is a built-in tab. Pick a different name.").
9. As a visitor, I want hovering a tab (except Home) to show a × that doesn't shift the layout, so that closing a tab is quick.
10. As a visitor, I want closing a tab to shelve it in All tabs instead of deleting it, so that I never lose a feed by accident.
11. As a visitor, I want closing the tab I'm on to take me to its neighbour (right, else left, else Home), so that I always land somewhere sensible.
12. As a visitor, I want the tab bar limited to 8 spaces (Home + Explore + my feeds), so that it never overflows; when it's full I'm told "The tab bar is full".
13. As a visitor, I want an All tabs page split into "In the tab bar (x of 8 spaces)" and "Only in All tabs", each with a one-click Add to tab bar or Move to All tabs, so that I can manage feeds in one place.
14. As a visitor, I want a shelved feed I open to appear temporarily in the bar with a pin to keep it there, so that I can bring it back easily.
15. As a visitor, I want to delete my own feeds (after confirming) but not the built-in ones, so that I can clean up without breaking the app.
16. As a visitor, I want to reorder my tabs, so that the bar matches how I use it.

### Settings line and popups
17. As a visitor, I want a sentence under the feed header like "Showing 4 topics · 10–60 min videos · 30–90 min sessions · 5 filters on · ⋯", so that I can see a feed's settings at a glance.
18. As a visitor, I want hovering a phrase to open its popup after a short delay, clicking to keep it open, and Esc or clicking outside to close it, so that settings sit where I'm looking.
19. As a visitor, I want the topics phrase to follow the feed kind (topics on my feeds, channels on Subscriptions, boosted topics on Everything, "all news" / "Tech news" on News), so that the wording is always accurate.
20. As a visitor, I want to add and remove topics (or channels) in the popup, so that I control what the feed shows.
21. As a visitor, I want to hide a topic from a feed and show it again (it appears crossed out with an eye icon), so that I can mute something without forgetting it.
22. As a visitor, I want a min–max slider plus number boxes for video length, so that I only see videos of a length I want.
23. As a visitor, I want the same control for session time, so that Up next fits the time I have.
24. As a visitor, I want range inputs clamped to their limits, swapped if min is above max, and non-numbers rejected with a message, so that I can't put a feed into a broken state.
25. As a visitor, I want a slider drag to update Up next without the popup closing or jumping, so that I can see the effect while I adjust.
26. As a visitor, I want a filters popup with Hide clickbait, Honest titles, Hide view counts, Hide subscriber counts, Boost small creators and Include Shorts, so that I control the whole app's tone.
27. As a visitor, I want Honest titles to replace both the title and the clickbait thumbnail caption (dropping its arrows and rings), so that clickbait loses all its hooks.
28. As a visitor, I want a ⋯ popup with Move to All tabs / Show in tab bar and Delete tab, so that tab options are near the feed.
29. As a visitor, I want an amber warning when the session would be shorter than my minimum session time, so that I know to loosen my settings.

### Feed-specific behaviour
30. As a visitor, I want Everything to rank by the topics and channels I've watched plus popularity, leaving out what I've watched, so that it feels like a home page.
31. As a visitor, I want Subscriptions to show my followed channels newest first, so that I catch up on uploads.
32. As a visitor, I want Most viewed to rank by views with a 24 hours / Last year / All time toggle and #1, #2… badges, so that I can see what's popular.
33. As a visitor, I want News newest first, with live clips on top under a red LIVE badge, and All / World / Business / Tech / Science chips, so that I can scan the news by area.
34. As a visitor, I want my own feeds to mix their topics from the last year, with small creators first when Boost small creators is on, so that I discover new channels.

### Cards
35. As a visitor, I want a grid (3 per row, the default) or list view, remembered in my browser, so that the feed looks the way I like.
36. As a visitor, I want every grid card to be the same size, so that the grid stays tidy.
37. As a visitor, I want a designed YouTube-style thumbnail for each video (gradient, outlined caption, accent label, icon, duration badge such as 34:35), so that the demo looks like the real thing.
38. As a visitor, I want card details (channel, subscribers, views, topic, age) to respect Hide view counts and Hide subscriber counts, so that numbers don't sway me.
39. As a visitor, I want a description box (two lines with …more in list view, a full-width panel under the row in grid view), so that I can read about a video without the card growing.
40. As a visitor, I want hovering a card's topic to offer Add to / Remove from this feed (Boost on Everything), Hide here and Show again, so that I can tune the feed from a video.
41. As a visitor, I want hovering a card's channel to offer Add to / Remove from Subscriptions, so that following a channel is one step.
42. As a visitor, I want an Already watched toggle on each card (a red progress bar and a "Watched" label), so that videos I've seen elsewhere count.
43. As a visitor, I want a Videos like this row (10 similar videos, each with + to add to the session), so that I can follow a thread.
44. As a visitor, I want to remove a video from the session, so that Up next only holds what I want.
45. As a visitor, I want to save a video to a folder (Watch later, Weekend, Learning, or a new folder), so that I can come back to it; saving twice says "Already in <folder>."

### Session: Finished, Watching now, Up next
46. As a visitor, I want clicking a video's thumbnail or title to open a YouTube search for it in a new tab and make it Watching now, so that I can watch it.
47. As a visitor, I want a message if the browser blocks the new tab, so that I know why nothing opened.
48. As a visitor, I want a video to move to Finished only when I click Finished or start another video, so that switching back to write a note doesn't end it early.
49. As a visitor, I want the Finished button to turn blue when I come back to the page, so that I'm gently asked whether I'm done.
50. As a visitor, I want to move a Finished video back to Up next, so that a mis-click is easy to fix.
51. As a visitor, I want an "Up next" line with the planned minutes against my session range, so that I know how long this sitting will be.
52. As a visitor, I want clicking the Yourfeed logo to load a new set for the current feed, skipping what I just saw and starting over when nothing new is left, so that I can reroll without leaving the feed.
53. As a visitor, I want a round undo button by the search area for 5 seconds after a refresh (without shifting the header), so that I can get the previous set back.

### Notes
54. As a visitor, I want a notes box under Watching now and each Finished video, so that I can write as I watch.
55. As a visitor, I want a video's notes to be the same wherever that video appears, so that I keep one record per video.
56. As a visitor, I want typing in notes never to lose my cursor or focus, so that writing feels normal.
57. As a visitor, I want a collapsed Feed notes section at the bottom listing every Finished and Watching now video with its notes, plus a note for the whole feed, so that I can review a session.
58. As a visitor, I want to copy Feed notes as Markdown ("Notes copied."), so that I can keep them elsewhere.
59. As a visitor, I want a mic button on notes for voice typing where the browser supports it, with a clear message when the microphone is blocked or unsupported, so that I can take notes hands-free.

### Saved and Watch history
60. As a visitor, I want a collapsed Saved section with folders that open and close and a New folder button, so that saved videos stay organised.
61. As a visitor, I want a collapsed Watch history section (newest first) where I can remove one video or clear all after confirming, so that history stays useful.
62. As a visitor, I want a + on saved and history videos to add them to the current session, so that I can pull old finds into today (drag and drop is a bonus, + is the touch fallback).

### Undo, persistence and quiet
63. As a visitor, I want undo and redo (up to 10 steps each, with count badges; a new change clears redo) covering topic, channel, range and filter changes, so that experimenting is safe.
64. As a visitor, I want my feeds, settings, sessions, notes, saved folders, history and view choice saved in my browser, so that a reload changes nothing.
65. As a visitor, I want the app to keep working (with everything in memory) if browser storage is blocked or corrupt, so that a private window still works.
66. As a visitor, I want a "Reset demo" option, so that I can get back to the starting example.
67. As a visitor, I want the app to stay quiet except for errors, no-ops ("Already in this feed."), results I can't see ("Link copied.") and direct answers, so that it never nags.
68. As a visitor, I want a clear message and a retry when the backend can't be reached, so that I'm not stuck on "Loading…".

### Look and access
69. As a visitor, I want the neutral YouTube-like light theme and the matching dark theme following my system setting, so that the app feels familiar.
70. As a keyboard or screen-reader user, I want every popup, tab, toggle and card action to be reachable and named (the home tab is "Everything (home)"), so that the app works without a mouse.
71. As a visitor, I want a "Not affiliated with YouTube" line in the footer, so that nobody mistakes this for an official product.

## Implementation Decisions

- **Respects ADRs 0001–0005.** Demo mode only. The backend stays the source of the catalog. Composition stays in the frontend (ADR 0003).
- **Composition is reused, not rewritten.** The existing `composeFeed` (catalog + feed + global filters + watched → Up next, hidden count, used minutes) drives every feed in scope. Its input grows only where the stories need it: the topic list on Everything acts as "boosted topics", and Most viewed takes its time range from the feed.
- **The prototype's seed bug stays fixed.** Reshuffles use the seeded rank (murmur-mixed), not the prototype's suffix hash.
- **One app state, changed only through actions.** A single immutable state (feeds keyed by name in tab order, global filters, notes by video id, saved folders, watch history, watched ids, view choice, undo/redo stacks) is changed by a pure reducer. Every action returns new state and nothing is mutated. Undo snapshots cover the feed-settings actions only (topics, channels, mutes, ranges, filters), at most 10 steps.
- **Feed shape** extends the current domain type with: name, kind (including `topics` for user feeds), shelved, draft, colour index, and the Most viewed time range. Built-in kinds in scope: `home`, `subs`, `top`, `news`. Built-in feeds can be shelved, never deleted.
- **Demo seed state** comes from the mockup: Everything, Subscriptions (its 7 channels), Most viewed, News, Learn, Sport, Wind down (shelved), Cooking (shelved), the three saved folders, and the initial watched list, re-keyed to the catalog's `demo-N` ids.
- **Two injected ports, and the app depends only on these interfaces:**
  - *Catalog loader:* `() => Promise<readonly Video[]>`. Production uses the existing API client. Tests pass a fixed catalog.
  - *State storage:* `load(): unknown | null` and `save(state): void`. Production wraps `localStorage` under one versioned key, with try/catch so it works when storage is unavailable. Tests pass an in-memory store.
- **Saved state is validated on load.** It's treated as untrusted. A schema check (zod) rejects unknown or old versions and falls back to the demo seed, logging a warning. Saves are debounced.
- **Thumbnails:** the mockup's per-video thumbnail designs (`THUMBS`) move to a data table keyed by demo video id, rendered by one thumbnail component. Videos without a design get the generic topic fallback. Duration text is derived as in the mockup.
- **Descriptions:** generated from title, topic and length as in the mockup (topic context, chapters, sign-off), in a pure helper.
- **Popups:** one hover/click popup controller (120ms open delay, 220ms close delay, pinned on click or focus, Esc and outside click close) shared by the settings line, card topic/channel words and Explore.
- **Styling:** plain CSS with the mockup's design tokens (`--surface-*`, text, accent, Claude orange) and both themes. Icons from the Tabler icon set as a pinned npm package, not a CDN.
- **Opening a video** builds the same YouTube search URL as the mockup (title + channel) and opens it in a new tab with `noopener`.
- **Files stay small:** one component per area (tab bar, Explore, settings line, popups, card, thumbnail, session, notes, saved, history, all tabs page), each under about 400 lines.

## Testing Decisions

- **Good tests check behaviour a visitor can see** through the main seam: render the app, act like a user, assert on what's on screen. They don't reach into components, the reducer or the store, so internals can be restructured freely.
- **Seam 1 (main, new): the whole app.** Rendered with Testing Library on Vitest (jsdom), with an injected fixed catalog and in-memory storage. Each user story group gets tests here: switching tabs and Explore, closing/shelving and the 8-space limit, name rules, each settings popup and range validation, filters (including Honest titles changing the title), feed-kind ordering visible in the DOM, Finished / Watching now flow (with `window.open` stubbed), notes keeping focus, logo refresh and its undo, undo/redo counts, persistence across a re-render with the same storage, and recovery from corrupt storage.
- **Seam 2 (existing): `composeFeed`.** Its 12 unit tests stay as the prior art and the place for ordering and filtering edge cases. New edge cases (boosted topics on Everything, Most viewed time range) are added there.
- **Seam 3 (new, thin): Playwright smoke.** Against the real backend and the demo catalog: load the app, open a feed from Explore, change the length range, reload, and see the change kept. No duplicate coverage of seam 1.
- **Backend:** no backend changes are expected. The existing catalog API tests stay green.
- **Coverage target:** 80%+ on the frontend, measured through seams 1 and 2.

## Out of Scope

- Search and autocomplete, voice search.
- The Claude bar, the edit/new switch, question cards, Ask in your notes, and all AI (next spec, ADR 0004).
- From Claude, Blend, Shared with you and Share.
- Google sign-in, the YouTube catalog, and saving state on the server (ADR 0005).
- Edit mode (multi-select tabs). Reordering is covered by story 16 without it.
- Account menu.
- Mobile-first layout (the layout must not break at phone width, but isn't optimised for it).

## Further Notes

- `prototype/index.html` is the reference for look and behaviour. When this spec and the prototype disagree, this spec wins. Where this spec is silent, match the prototype.
- PROJECT.md's research takeaways are why the design looks this way: controls inside the feed, every change visible and undoable, channel-level controls trusted most, no unneeded messages.
- Once this lands, the prototype's "Persistence" and "Known limits" notes are out of date and should be updated.
