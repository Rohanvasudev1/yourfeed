# Yourfeed: a custom YouTube feed (prototype)

A product experiment: what if viewers chose their own feed instead of the recommendation engine choosing for them? This isn't a claim that YouTube's algorithm is bad (it's very good). The point is to explore how far "maximum customization" can go before it gets in the way.

The current state is a **clickable, single-file mockup** (`index.html`). All data is made up and all "AI" behaviour is simulated with keyword rules.

## How to open it

Open `prototype/index.html` in any browser. No build step is needed. Icons load from a CDN (Tabler Icons webfont), so it needs an internet connection the first time.

If a browser blocks local files, serve the folder instead:

```bash
python3 -m http.server 8765 --directory prototype
```

Then visit http://localhost:8765. The `.claude/launch.json` file has the same server set up for Claude Code's browser preview.

## Where the idea came from

1. Started from YouTube's 2026 **Custom Feeds** (Gemini prompt → its own home tab, one feed at a time).
2. Tried a bubble/"pick your interests" onboarding. Dropped it because it felt generic.
3. Listed everything a feed could let you customize, and where AI fits in.
4. Built a control-panel mockup, then iterated on it many times (summarized below).
5. Tried **mood presets** (Focused, Curious, Hyped and so on). **Dropped them** after research showed tabs/feeds already do that job and moods felt tacky.

## Research takeaways (Nov 2026)

- **Most people never open a settings panel.** Controls inside the feed get used, while separate settings pages get forgotten. ([Georgetown KGI](https://kgi.georgetown.edu/wp-content/uploads/2025/02/Better-Feeds_-Algorithms-That-Put-People-First.pdf), [CHI 2020](https://dl.acm.org/doi/fullHtml/10.1145/3313831.3376583), [Compass 2026](https://arxiv.org/html/2608.04274))
- **Show the effect of every change.** Controls that seem to do nothing feel like placebos. ([Illusion of Control](https://www.researchgate.net/publication/324669887_The_Illusion_of_Control_Placebo_Effects_of_Control_Settings))
- **Channel-level mute is the control people trust most.** YouTube's "Don't recommend channel" blocked about 43% of unwanted recommendations, while "Not interested" blocked about 11%. ([Mozilla](https://www.mozillafoundation.org/fr/youtube/user-controls/))
- **More options aren't automatically better.** ([Pilot](https://arxiv.org/html/2509.19615v2))
- **How the major platforms do it:** YouTube turns a prompt into a tab ([TechCrunch](https://techcrunch.com/2026/09/23/youtube-will-let-you-build-your-own-algorithm-with-ai/)). Instagram and Facebook show an editable "Your Algorithm" topic list ([gHacks](https://www.ghacks.net/2026/06/12/instagram-expands-your-algorithm-controls-to-main-feed-letting-users-adjust-recommended-topics/)). Threads offers temporary 1, 3 or 7-day adjustments ([Digital Trends](https://www.digitaltrends.com/social-media/threads-makes-it-easier-to-find-your-community-and-tune-out-what-you-dont-want-to-see/)). TikTok has topic sliders, smart keyword filters and a feed reset ([TikTok](https://newsroom.tiktok.com/tiktoks-new-features-to-help-you-control-your-scroll)). Bluesky lets you pin feeds as tabs.

**Design principles that came out of this:** tabs are feeds; editable topic lists; controls on the video itself; every change visible and undoable; AI turns plain language into settings you can see and edit.

## What the mockup does now

### Header
- **Yourfeed logo:** loads a **new set of videos for the tab you're on**, skipping the ones you just saw. When a feed has nothing new left it starts over. A round **undo icon** (to the left of the search bar, so nothing else moves) brings the previous set back for 5 seconds. The home icon in the tab bar is the way back to Everything.
- **Account icon** (top right): a menu with All your feeds, Saved, Watch history, Feed notes, Blends and Connect Claude, with counts. Each one jumps to that place. Sign-in is not part of the prototype.
- **Search bar** (top right, next to the mic and account icon): compact at about 280px and widening to 420px while focused, with a separate mic button (the mic is visual only). Enter opens a **search results page** with an arrow back button. Each result has **Add to session** in its bottom-right corner.
- **Google-style autocomplete:** focusing the search box shows recent searches (clock icon, × to remove). Typing suggests completions from video titles, channels and topics, ranked by popularity with short queries first, with the part you haven't typed in bold. ↑/↓ moves through them and previews each one in the box, Esc restores what you typed, Enter or click searches, and the ↖ button fills a suggestion in without searching. Every search is added to recent searches (up to 8).

### Tabs (each tab is a feed)
- **Closing tabs:** hover any tab (except Home) and a Safari-style **×** appears. The same × is on each row of the Explore menu. Closing moves the tab to All tabs, so nothing is deleted. Closing the tab you're on jumps to its neighbour. The 8-tab limit counts what you see in the bar: Home, the Explore button and your own feeds.
The tab bar shows the **home icon**, then one **Explore ▾** button holding the built-in feeds (Subscriptions, Most viewed, News, From Claude, Blend, Shared with you), then your own feeds. Hover or click Explore for a menu with each feed's icon, description and unread count. While a built-in feed is open, the button shows its name (e.g. "Blend ▾"). **Edit** mode still lists every tab separately for moving and reordering.

| Tab | What it does |
|---|---|
| **Everything** (default, shown as a home icon in the tab bar) | YouTube-style home page: ranked by what you've watched (topic and channel), plus popularity. Watched videos are left out. The sidebar shows "Boost topics". |
| **Subscriptions** | Newest uploads from channels you follow. The sidebar lists channels. |
| **Most viewed** | Ranked by views, with a **24 hours / Last year / All time** toggle and #1, #2… badges. |
| **News** (in Explore) | News clips from news channels, newest first, with live coverage pinned to the top and a red **LIVE** badge. Chips filter by All / World / Business / Tech / Science. Video length and session limits still apply. |
| **From Claude** | After you connect, it builds a feed from a short summary of your recent Claude work, and asks "What would you like to add?" |
| **Blend** | Type a friend's `@username` to send an invite. The blend only starts once they approve it in their own account (the mockup has a "Simulate their approval" button, plus Cancel invite). Then it merges both tastes, with a low-key "72% match", and each card says whose taste it came from. A collapsible **Previous blends** list under the Blend with a friend card reopens any past blend in one click (or removes it). The demo starts with two example blends. |
| **Shared with you** | An inbox of feeds other people sent you. Each one shows who sent it, their note, the video count and length, a thumbnail strip and a blue dot if it's new (the tab shows an unread count). Open one to watch it right here in the sender's order, see the notes they included, and use the usual Watching now / Finished / notes. **Save as my feed** turns it into your own tab. × removes it. Coming back to the tab shows the inbox again, and reopening a share keeps your progress. |
| **Learn / Sport / your own** | Feeds built from topics. |

- **+** creates a new feed: a draft tab with a "Name this feed" box. Saving a name **or** telling Claude what you want creates the feed. An unused draft is removed when you leave the tab.
- **All tabs** (grid icon with count) opens a separate page with every feed. Closes with a minimize icon. The tab bar holds 8 tabs, and overflow lives on this page.
- **Edit** works like Photos' select mode: select several tabs, then **Move to All tabs**, **Show in tab bar** or **Delete** (with confirmation). You can also **drag tabs to reorder** them. Built-in tabs (Everything, Subscriptions, Most viewed, From Claude, Blend) can't be deleted, only moved to All tabs.

### Feed settings line (replaces the sidebar)
There's no sidebar. Under the Claude bar, one line reads like a sentence, e.g. "Showing **4 topics** · **10–60 min** videos · **30–90 min** sessions · **5 filters on** · **⋯**". Hover a bold word to open its popup, click to keep it open, and press Esc or click outside to close it. The popups hold exactly the controls the sidebar had:
- **Topics / channels / boosts:** add, remove, and hidden topics (crossed out, eye icon to restore).
- **Video length** and **session time:** min–max range sliders plus number boxes, with the same checks (clamped to range, swapped if min is higher than max, non-numbers rejected).
- **Filters:** hide clickbait, honest titles, hide view counts, hide subscriber counts, boost small creators, include Shorts.
- **⋯ (tab options):** Move to All tabs / Show in tab bar, and Delete tab with confirmation (built-in tabs can't be deleted).

**Quick actions on cards:** hover (or click) a video's **topic** for "Add to / Remove from this tab" (or Boost / Stop boosting on Everything), "Hide here", "Show again" and "Search". Hover a **channel** for "Add to / Remove from Subscriptions" and "See all their videos".

### Messages (kept to a minimum)
The app only shows a message when you'd otherwise be left guessing:
- **Errors:** pop-ups blocked, copying failed, the microphone is blocked or unsupported, the tab bar is full.
- **Nothing visibly happened:** "Already in this feed."
- **The result isn't on screen:** "Link copied.", "Notes copied."
- **Direct answers:** e.g. "why is the top video here".

Everything else is silent because the change is visible: adding or hiding topics, opening, finishing or marking videos, closing tabs, invites and approvals, undo/redo. There's no "How do these look?" card after adding topics (undo covers it), and no "Welcome back" line (the Finished button still turns blue when you return).

### Claude command bar (top of the feed)
- **Edit / new switch** (a small sliding switch in the bar): off, with the ✏️ knob on the left, is **Editing <feed>** and Claude changes the current feed. On, blue with the ⊕ knob on the right, is **Making a new feed**: a request opens a new tab built from it, named from the topics Claude adds, or with a follow-up question for broad requests. Hovering shows a tooltip explaining the mode and that clicking switches it. On **built-in tabs** it's locked to new-feed mode. The placeholder follows the mode: "Tell Claude what to change in Learn" vs "Tell Claude what you want to watch".
- **Reserved names:** tabs can't share a name with a built-in tab (Everything, Subscriptions, Most viewed, News, From Claude, Blend, Shared with you), in any capitalisation. If Claude's name would clash it adds " picks" (e.g. **News picks**). Typing a built-in name yourself shows an error.
- A slim rounded bar: Claude asterisk, input, **undo** and **redo** buttons (each keeps up to 10 steps, with a count badge, and a new change clears redo), and a **square blue send button** (styled like Claude's, in a different colour).
- **Typing changes only the feed and its topics.** There's no chat transcript, and Claude stays quiet unless a message is really needed (see Messages below).
- **Decides whether to ask or act:**
  - Specific request ("tennis", "more MCP tutorials") → adds it immediately.
  - Broad request ("add some sport") → asks a follow-up with options to pick ("Which sports?").
  - Vague request ("surprise me") → "Pick the ones you're feeling" with 4 videos to choose from.
  - Question cards stay until you answer or dismiss them.
- It also understands "why is the top video here", "save the top video", "less/no X", "shorter" and "longer".

### Feed
- **Grid or list view** toggle (3 or 1 videos per row). **Grid is the default**, and each viewer's choice is remembered in their browser (`localStorage`, falling back to grid if storage is blocked). In grid view every card is the same size: a 16:9 thumbnail, a two-line title, single-line details, a one-line description preview and a full-width row of four buttons. Opening the description, "Save to" or "Videos like this" outlines the card and opens a full-width panel under its row, so the card itself never grows.
- **Descriptions:** every feed card has a YouTube-style description box. In list view it shows two lines with "…more" and expands in place ("Show less" to collapse). In grid view the full text opens in the panel under the row. The mock descriptions are generated (summary, topic context, chapters with timestamps, channel sign-off).
- **Share** (right of the "Up next" line) opens a share panel for the current set of videos: Finished, Watching now, pinned and Up next, in order. **Every video has a checkbox** (all ticked to start), with Select all / Clear all and a live "7 of 9 selected" count. Unticked videos are greyed out and left out of the link and the send. With none selected, Copy link and Send are disabled. Below the list: a link with **Copy link**, **Send** to a Yourfeed `@username` (with previous blend partners as one-click suggestions), and an optional **Include my notes**. In the demo, the link is a placeholder and nothing is actually sent.
- Video card actions are icons: **Save** (choose a folder), **Already watched** (red progress bar on the thumbnail plus a "Watched" label), **Videos like this** (a horizontally scrollable row of 10 similar videos, each with **+** to add to the session), and **Remove from session**.
- Clicking a thumbnail or title counts as a watch: it goes into watch history and teaches the Everything tab.
- An amber warning appears when the session is shorter than your minimum session time.

### Saved and Watch history (bottom, collapsed by default)
- **Saved:** folders like Finder (folder icon opens and closes), full video cards inside, new folder button, and **drag a saved video into the feed** to add it to the current session.
- **Watch history:** newest first, remove individual videos, clear all (with confirmation). Videos can also be dragged into the feed.

### Watching and notes
- Clicking a video opens a YouTube search for it in a new tab (the videos are made up, so it searches by title and channel) and puts it under **Watching now**, between **Finished** and **Up next**.
- **Watching now** has a notes box. When you come back to the page it asks whether you're done; **Finished** (or starting another video) moves it to the **Finished** section at the top, where each video keeps its own notes box. The undo arrow moves a finished video back to Up next.
- **Ask in your notes** (inspired by riddled.ai): every video notes box doubles as a question box. Write a line ending in `?` and press Enter (or press the asterisk button). The question gets an underline and a pulsing dot while it "thinks", then the answer is written into the note on the next line, starting with a Claude ✱, with its words fading in. It's ordinary note text after that: you can edit or delete it, and it's included when you copy the notes.
- **Feed notes** (collapsed by default, at the bottom with Saved and Watch history): every watched video in the current feed with its notes, plus a note for the whole feed. The copy button exports everything as Markdown.
- Every notes box has a mic button for voice typing (Web Speech API: Chrome, Edge and Safari; needs microphone permission and localhost or https).

### Built-in tabs
- Everything, Subscriptions, Most viewed, From Claude, Blend and Shared with you can't be deleted, but they can be moved to All tabs from the sidebar, from edit mode, or from the All tabs page.
- The All tabs page is split into "In the tab bar" and "Only in All tabs", and each card has a one-click **Add to tab bar** or **Move to All tabs** button. A shelved tab you're viewing shows a pin in the tab bar to keep it there.

## What's simulated in the mockup
- **Videos:** 38 made-up videos with fictional channels, including 7 news clips about made-up, generic stories (no real events or outlets). Each has a designed **YouTube-style thumbnail** built in HTML/CSS: a saturated gradient, a big outlined caption with a coloured sub-label, a hero icon, a dark duration badge with real-looking times (e.g. 34:35, 1:14:32), and a red progress bar when watched. Clickbait videos get red arrows and rings, which are swapped for a calm caption when **Honest titles** is on. A real version would use the API's `snippet.thumbnails` images.
- **AI:** keyword regexes (`TOPIC_RX`, `BROAD`) stand in for an LLM. Honest titles and clickbait flags are hand-written.
- **Share:** the link (`yourfeed.example/s/…`) is a hash of the video set, and sending only records the name.
- **Shared with you:** three demo shares (from @maya.k, @devon_r with notes, @sam_k). A real version would store shares server-side per recipient and fill this inbox from them.
- **Blend:** invites aren't sent anywhere, and approval is simulated with a button. The friend's taste is generated from a hash of their username.
- **Ask in your notes:** answers come from the video's title, topic and channel plus a small glossary, not from the video itself.
- **From Claude:** the "recent work" summary is hard-coded.
- **Persistence:** only the grid/list choice is remembered (browser storage). Everything else resets when the page reloads.
- **Descriptions:** generated from each mock video's title, topic and length.
- **Voice search:** visual only. (Voice typing in notes is real.)
- **Notes:** kept in memory only, like everything else.

## Plan for a real version

**Data**
- YouTube Data API v3 for search, details, subscriptions and stats. Full descriptions come from `videos.list` with `part=snippet` (`snippet.description`, 1 quota unit per call for up to 50 videos). `search.list` only returns a shortened description. The default quota is 10k units a day and a search costs 100, so lean on channel RSS feeds (`/feeds/videos.xml?channel_id=…`), which are free.
- Don't download videos or scrape transcripts, which goes against YouTube's terms.

**AI pipeline: run once per video, store the result, share it with every user**
1. Cheap pass on every video: title, description and thumbnail → topic tags, mood/format, clickbait score, honest title, short summary.
2. Moderate pass on videos that survive the filters: a video model watches the first 2–3 minutes. Gemini can take a public YouTube URL directly. Claude takes images and text only, so it would need frames plus a transcript.
3. Expensive pass only on request: a full watch-through for detailed summaries and chapters.

The toggles then filter stored data, so changing them is instant and costs nothing.

**Claude command bar:** a backend endpoint (never call the API from the browser) that calls the Claude API with tools such as `set_topics`, `mute_topic`, `set_length_range`, `save_video`, `ask_user`. The UI applies the tool results and records an undo snapshot.

**Ask about this video:** a backend endpoint that calls Claude with the stored summary and transcript, plus the playback time if the player exposes it.

**Blend invites:** stored server-side (from, to, status). The invited person approves or declines in their own account, and the blend reads their taste profile only after approval.

**From Claude:** there's no public API for an outside app to read someone's Claude memory. The clean route is to expose the app as an **MCP server** with tools like `set_feed_topics`. The user adds it as a connector in Claude and says "update my feed from what I've been working on". Claude sends only a short summary, never the chats.

**Suggested stack:** Next.js + TypeScript, Postgres (videos, tags, feeds, folders, history), a scheduled worker for RSS/API polling and AI tagging, Claude API for the command bar.

## Open questions and next steps
- Should Claude's question cards also disappear after a while, or stay until answered (current)?
- Should one-off chat changes expire after a set time (Threads-style "just for tonight")?
- Touch support for drag and drop: on touch screens the "+" buttons are the fallback.
- Mobile layout: the mockup is desktop-first.
- Split `index.html` into components when moving to a real codebase. It's one large file because it grew as an inline mockup.
- Real thumbnails and data through the YouTube API.
- Persist state (localStorage at first, then a backend).
