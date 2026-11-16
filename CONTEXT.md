# Yourfeed: domain language

Yourfeed is an open-source design exploration of YouTube's custom-feeds idea, and a product you can actually use: you choose your feed instead of the recommendation engine choosing it for you. These are the words the code and docs use. When a term changes, change it here first.

## Core terms

- **Video**: one YouTube video as Yourfeed sees it: id, title, honest title, channel, topic, length in minutes, views, age, and flags (clickbait, live, news category). It comes from a **Video source**.
- **Video source**: where videos come from. `demo` is the built-in mock catalog. `youtube` is a signed-in user's real subscriptions plus RSS and Data API lookups. The backend owns every source.
- **Catalog**: the set of videos a source returns for a user. The frontend builds feeds from it.
- **Feed**: a saved recipe for choosing videos. Every feed is a **tab**. It has a **kind** and its own settings: topics or channels, length range, session range, muted topics, pinned, removed and skipped videos, and a seed.
- **Feed kind**: `home` (Everything), `subs` (Subscriptions), `top` (Most viewed), `news`, `claude` (From Claude), `blend`, `shared` (Shared with you), or `topics` (a feed you made). Every kind except `topics` is **built-in**: it can be shelved but not deleted.
- **Tab bar**: the feeds currently shown, at most 8 spaces (Home + one Explore button + your own feeds).
- **Shelved**: a feed moved off the tab bar into All tabs. Nothing is ever deleted by closing a tab.
- **Explore**: the one tab-bar button that groups the built-in feeds other than Home.
- **Length range**: the shortest and longest video, in minutes, that a feed shows.
- **Session range**: the minimum and maximum total minutes a feed plans for one sitting. **Up next** stops filling once the session maximum would be passed.
- **Session**: a feed's current sitting. It has **Finished** videos, at most one **Watching now** video, and **Up next**.
- **Finished**: the user said they're done with the video. Returning to the page never marks a video Finished by itself.
- **Feed set**: which videos a feed shows right now: its seed plus its skipped videos. Clicking the logo loads a new set that skips what was just shown, and starts over when nothing new is left; undo brings the previous set back for 5 seconds.
- **Pinned**: videos the user added to this session by hand, which always count toward the session.
- **Composition**: the pure function that turns a catalog, a feed and global filters into Up next plus a hidden count. It's the heart of the app (`composeFeed`).
- **Time range**: Most viewed's window: last 24 hours, last year or all time (`topRange`).
- **Global filters**: Hide clickbait, Honest titles, Hide view counts, Hide subscriber counts, Boost small creators, Include Shorts.
- **Honest title**: a plain, non-clickbait version of a title. With Honest titles on, it replaces the title and the thumbnail caption.
- **Settings line**: the sentence under the Claude bar ("Showing 4 topics · 10–60 min videos …"). Each phrase opens a popup that edits that setting. It replaces a settings sidebar.
- **Claude bar**: the plain-language command box. Despite the name, any OpenAI-compatible model can run it (see ADR 0004). An **assistant** turns a request into **feed actions** the user can see and undo.
- **Feed action**: one structured change to a feed: `set_topics`, `mute_topic`, `set_length_range`, `set_session_range`, `pin_video`, `ask_user`. Undo and redo work on these.
- **Undo step**: the feed settings (topics, channels, mutes, length and session ranges) and global filters as they were before one change. Any change to those, by hand or by a feed action, adds one; undo and redo keep up to 10 each, a new change clears redo, and moving the same range on the same feed again (say, dragging its slider) extends the newest step instead of adding one. A reload or Reset demo starts with none. Sessions, feed sets and tabs are never undone.
- **Notes**: free text per video (the same everywhere the video shows up), plus one note per feed. A line ending in `?` asks the assistant, and the answer is written into the note as `✱ answer`.
- **Demo mode**: not signed in. Mock catalog, state kept in the browser, rate-limited AI.
- **Signed-in mode**: signed in with Google. Real YouTube catalog, state kept in the database.

## Avoid

- "Algorithm" for a feed: say **feed**.
- "Watched" to mean Finished: **watched** is the eye toggle ("I've seen this elsewhere"), while **Finished** is part of a session.
- "Playlist" for a feed or a saved folder: playlists are YouTube's. Ours are **feeds** and **saved folders**.
