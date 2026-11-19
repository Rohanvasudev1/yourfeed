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
- **Pinned**: videos the user added to this session by hand, which always count toward the session. They come first in Up next. The + on a saved or history video pins it.
- **Removed**: videos the user took out of a feed's session with a card's trash button. Up next leaves them out until they're pinned again.
- **Boost**: on Everything, the feed's topics don't limit what shows; they rank those topics higher. Adding a topic there is boosting it. Not the same as the Boost small creators filter.
- **Card quick actions**: what a card offers besides playing: its topic and channel open popups (add, remove or boost the topic, hide it here or show it again; follow the channel in Subscriptions), the eye toggle (mark **watched**), **Videos like this** (ten similar videos, each with + to pin) and the trash button (**Removed**).
- **Saved folder**: a named list of videos the user saved (Watch later, Weekend, Learning, or their own). Saving a video twice to one folder changes nothing and says "Already in <folder>."
- **Watch history**: every **watched** video, newest first. Playing a video adds it; moving a Finished video back to Up next takes it out again, since that undoes a mis-click. Everything ranks by it and hides what's in it.
- **Composition**: the pure function that turns a catalog, a feed and global filters into Up next plus a hidden count. It's the heart of the app (`composeFeed`).
- **Time range**: Most viewed's window: last 24 hours, last year or all time (`topRange`).
- **Global filters**: Hide clickbait, Honest titles, Hide view counts, Hide subscriber counts, Boost small creators, Include Shorts.
- **Honest title**: a plain, non-clickbait version of a title. With Honest titles on, it replaces the title and the thumbnail caption.
- **Settings line**: the sentence under the Claude bar ("Showing 4 topics · 10–60 min videos …"). Each phrase opens a popup that edits that setting. It replaces a settings sidebar.
- **Claude bar**: the plain-language command box ("Tell Claude what you want to watch"). Despite the name, any OpenAI-compatible model can run it (see ADRs 0004 and 0006). An **assistant** turns a **request** into **feed actions** the user can see and undo.
- **Assistant**: whatever answers Claude bar requests and note questions: a **model** (OpenAI-compatible, on the backend), the **keyword rules** (the mockup's matching, used when no model is set up, it fails, it times out or a limit is reached), or a **scripted fake** in tests. The **account menu** names which one is answering.
- **Request**: one thing the user sent from the Claude bar, at most 300 characters. A request becomes zero or more feed actions plus an optional **reply**, and adds at most one undo step.
- **Bar mode**: **edit** (change the current feed) or **new** (start a new feed from the request). Built-in feeds can't be edited, so on them the bar is always in new mode; on a draft it's edit mode, since the draft is the new feed.
- **Feed action**: one structured change the assistant makes, always to the current feed: `set_topics`, `mute_topic`, `set_length_range`, `set_session_range`, `pin_video`, `ask_user` (shows a **question card**) and `create_feed` (new mode only). Topics must be in the catalog and pinned videos must be ones the assistant was shown; the backend drops any action that breaks a rule. The assistant never changes global filters, tabs, saved folders or other feeds.
- **Reply**: a short text answer from the assistant, such as why a video is first. Shown as a toast; it changes nothing.
- **Question card**: the assistant asking before it acts. **Chips** (pick topics), **videos** (pick the ones you're feeling, and their topics are added) or **feedback** (thumbs up keeps the added topics, thumbs down removes them).
- **Undo step**: the feed settings (topics, channels, mutes, length and session ranges, and a Blend's other person) and global filters as they were before one change. Any change to those by hand adds one, and so does each request, however many feed actions it ran. There is one history; the Claude bar's undo and redo use it too; undo and redo keep up to 10 each, a new change clears redo, and moving the same range on the same feed again (say, dragging its slider) extends the newest step instead of adding one. A reload or Reset demo starts with none. Sessions, feed sets and tabs are never undone, with one exception: undoing a request that ran `create_feed` removes that feed, and redo brings it back.
- **Notes**: free text per video (the same everywhere the video shows up), plus one note per feed. A line ending in `?` asks the assistant, and the answer is written into the note as `✱ answer`.
- **Ask in notes**: a note line of 3–300 characters ending in `?` is a **question**; pressing Enter after it (or the ✱ button) asks the assistant about that video. The assistant only knows the video's details and description, never a transcript, and answers in at most two sentences on the next line, starting with ✱.
- **Provider notice**: the line saying requests and note questions are sent to the named provider. Nothing is sent until the user presses send or asks a question.
- **AI limits**: per visitor, about 10 requests a minute and 100 a day, plus one daily cap for the whole site. Past a limit the keyword rules answer instead.

## Search and sharing

- **Search**: matches the query against title, honest title, channel and topic in the catalog, in the frontend. **Suggestions** come from titles, channels and topics weighted by views, with **recent searches** (kept in the browser, removable) first. The **search page** lists results; + pins one to the current feed ("Adding to: <feed>").
- **Share**: sending a feed's videos to someone. The user unticks what to leave out, may include their notes, then copies a **share link** or sends it to a **username**.
- **Share link**: a link whose URL fragment carries the shared feed itself (title, video ids, optional message and notes), so it works with no account and no server storage. Opening one adds it to Shared with you once. A link that's broken, too big or names unknown videos "doesn't work".
- **Shared with you**: the inbox of feeds others sent (`shared` kind). Each **shared feed** shows who sent it, its videos and their notes; it can be opened and watched like a feed, saved as your own feed, or removed. Unread ones show a dot.
- **Blend**: a feed mixing your topics with someone else's (`blend` kind). You invite a **username**; once they approve, the blend shows a **match score** and mixes topics you share, then yours, then theirs. Approved blends are kept as **your blends** (Previous blends), which Share offers as quick-send chips.
- **Simulated**: in demo mode there are no other users, so sending to a username, Blend's other person and their approval, and the From Claude connection are made up and labelled "Demo only". Share links are real.
- **From Claude**: the `claude` feed. **Connecting** it reads a summary of the user's recent Claude work and turns it into topics (simulated in demo mode with a fixed summary).

## Account and tabs

- **Account menu**: the avatar menu: who you are ("demo account" in demo mode), jumps to All your feeds, Saved, Watch history, Feed notes, Shared with you and Blends with their counts, the From Claude connection, and which assistant answers.
- **Edit mode**: selecting several tabs at once to move them to All tabs, show them in the tab bar or delete them. Built-in feeds can't be deleted, and at least one feed always stays.
- **Demo mode**: not signed in. Mock catalog, state kept in the browser, rate-limited AI.
- **Signed-in mode**: signed in with Google. Real YouTube catalog, state kept in the database.

## Avoid

- "Algorithm" for a feed: say **feed**.
- "Watched" to mean Finished: **watched** means in watch history (played here, or the eye toggle: "I've seen this elsewhere"), while **Finished** is part of a session.
- "Chat" for the Claude bar: it takes **requests** and makes feed changes; it isn't a conversation and keeps no history beyond undo.
- "Playlist" for a feed or a saved folder: playlists are YouTube's. Ours are **feeds** and **saved folders**.
