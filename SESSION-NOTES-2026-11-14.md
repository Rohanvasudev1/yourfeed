# Session notes: 14–15 Nov 2026

Work on the Yourfeed prototype (`index.html`, now about 1,290 lines). `PROJECT.md` describes the product and every feature as it stands. This file records what changed in this session, why, and what's still open.

## Where things stand

The prototype now has:
- **No sidebar.** A settings line under the Claude bar ("Showing **4 topics** · **10–60 min** videos · **30–90 min** sessions · **5 filters on** · **⋯**") opens popups on hover or click.
- **A 3-per-row grid by default**, with same-size cards, YouTube-style thumbnails and expandable descriptions.
- **A watching flow:** Finished / Watching now / Up next, with notes on every video.
- **Ask Claude inside your notes:** end a line with `?` and the answer is written in on the next line.
- **A simpler tab bar:** 🏠 · **Explore ▾** (all the built-in feeds, including a new **News** feed) · your own feeds.
- **Share** with per-video checkboxes, and a **Shared with you** inbox for feeds people send you.
- **Blend** as an invite with a list of previous blends.
- A compact **search bar at the top right** with Google-style autocomplete, next to an **account menu**.
- **Undo/redo** in the Claude bar.
- A **white, neutral colour scheme** (YouTube-like), with a matching dark mode.

Everything was checked in the Claude browser pane with no console errors. There are still no automated tests.

## What changed, by area

### Layout and navigation
- **Sidebar removed.** Its controls were moved, with the same element ids, into fixed popups (`#pop-topics`, `#pop-len`, `#pop-ses`, `#pop-filters`, `#pop-more`). That way `render()`, the sliders and validation work unchanged, and slider drags aren't interrupted by re-renders.
  - Popups open after a 120ms hover, close 220ms after you leave, and stay open when clicked or when something inside has focus. Esc or clicking outside closes them.
  - The wording follows the tab (channels on Subscriptions, boosted topics on Everything).
- **Quick actions on card words.** Hover a video's **topic** to Add/Remove (Boost on Everything), Hide here, Show again or Search. Hover a **channel** to Add/Remove from Subscriptions or see all their videos. Topic changes go on the undo list.
- **Account icon** top right (green "Y"). Its menu jumps to All feeds, Saved, Watch history, Feed notes, Blends and From Claude. The refresh-undo button sits just to its left.
- **Explore dropdown (15 Nov):** the built-in tabs except Home are folded into one **Explore ▾** button next to the home icon (`isGroupedTab`, `exploreChip`, `#pop-tabs`, using the same hover/click popup controller). The menu lists each built-in feed with its icon, description, unread count and a check on the current one. While one is open, the button shows its name and icon. Your own feeds stay as normal tabs, and Edit mode shows every tab separately so moving and reordering still work.
- **Everything tab is a home icon** (accessible name "Everything (home)").
- **Tabs.** Built-in tabs (Everything, Subscriptions, Most viewed, From Claude, Blend, Shared with you) can be moved to All tabs but not deleted. The All tabs page is split into "In the tab bar (x of 8)" and "Only in All tabs". A shelved tab you open gets a pin to keep it in the bar.
- **Removed:** the "Added by you" label and grid "Added" badge, and "picked for you" on the Up next line.

### Feed and cards
- **Grid is the default** (3 per row). Each viewer's choice is saved in `localStorage` (`yourfeed.view`, wrapped in try/catch, falling back to grid). It's the only thing that survives a reload.
- **Grid cards are always the same size:** a 16:9 thumbnail, a two-line title slot, single-line details, a one-line description preview, and a full-width 4-button bar. Save to, Videos like this and the full description open as a full-width panel under the card's row, so cards never grow.
- **YouTube-style thumbnails** (`THUMBS`, `thumbArt`):
  - Each of the 31 mock videos has a designed thumbnail: a gradient, a heavy outlined caption, a tilted accent label and a hero icon. "Graphs vs trees" uses a split VS layout.
  - Realistic duration badges (e.g. 34:35, 1:14:32), a red progress bar when watched, and rank badges on Most viewed.
  - Clickbait videos get red arrows and rings, swapped for a calm caption when **Honest titles** is on.
  - Container query units scale everything from the 22px share preview to full cards.
- **Descriptions.** The real API gives full text via `videos.list?part=snippet` (`snippet.description`, 1 quota unit per call). The mock videos get generated descriptions: summary, topic context, timestamped chapters and a channel sign-off. List view expands in place with …more / Show less. Grid view opens the full text in the panel under the row.

### News (15 Nov)
- **A News feed in Explore** (`kind:"news"`, built-in), between Most viewed and From Claude. It shows `News` clips newest first, with live ones pinned on top, and category chips (All / World / Business / Tech / Science, `NEWS_CATS`, saved per feed as `cat`). Video length and session limits still apply.
- **Data:** 7 mock news clips (IDs 31–37) from fictional channels (Daily Brief, World Desk, Tech Wire, Market Minute, Science Now) about generic, made-up stories, each with its own YouTube-style thumbnail. One is live: a red **LIVE** badge replaces the duration. Added "News" to `TOPIC_RX` and `TOPIC_BG`. News clips can also appear in Everything and in search.
- **Details:** the settings line shows "all news" / "Tech news" as plain text (categories come from the chips, not topics), and the Up next line says "newest first". When a built-in feed other than Shared with you is open, the Explore button shows Shared's unread count as a dot instead of a number, so "News 2" doesn't look like two news items.

### Claude bar wording, new tabs, closing tabs (15 Nov)
- **Placeholder** is now "Tell Claude what you want to watch" everywhere except a draft feed.
- **Requests on built-in tabs open a new tab.** In `send()`, if the current tab's kind is in `LOCKED`, it calls `newFeed()` first, then runs the request through the existing draft flow. A specific request names the tab after the topics (e.g. "tennis" → a "Tennis" tab). A broad one asks a follow-up in the new tab. This replaces the old "This tab builds itself" message.
- **Safari-style ×:** hovering any tab chip except Home shows an × (the space is reserved, so nothing shifts), and so does each Explore menu row. `closeTab()` moves the tab to All tabs rather than deleting it. Closing the open tab jumps to the next tab to the right, or the left if there isn't one. Edit mode and the temporary chip for a shelved tab don't get an ×.
- **Tab limit fix:** the 8-tab limit (`MAXBAR`) now counts visible chips (`barCount()`: Home + one Explore button + your own feeds) instead of every tab marked as in the bar. Before, new tabs went straight to All tabs because the folded built-ins still counted. The All tabs page shows "x of 8 spaces".
- **Reserved built-in names:** `uniqueName()` (used for every generated name: Claude-named drafts, new feeds, saved shares) now adds " picks" when a name matches a built-in tab in any capitalisation, and all name checks ignore case (`isBuiltinName`, `nameTaken`). So "news" on Everything gives "News picks", then "News picks 2". Naming a feed yourself with a built-in name shows "is a built-in tab. Pick a different name." Checked in the browser pane, no console errors.
- **Save feed (removed):** a button that saved the whole current feed into a Saved folder named after it. It was added and then removed at the user's request ("kind of stupid"). Saving single videos to folders still works as before.
- Checked in the browser pane: the placeholder, a new Tennis tab from Most viewed, a follow-up in a new tab from News, closing the active and other tabs and from Explore, Save feed creating then reporting "already saved", and the hover × visible. No console errors.

### Watching and notes
- **Finished / Watching now / Up next.** Clicking a video opens a YouTube search for it and makes it Watching now. It moves to Finished only when you click **Finished** or start another video, not automatically when you return to the page, because switching back to write a note would move it too early. Coming back makes the Finished button turn blue and ask "Welcome back, are you done?".
- **Notes** are stored per video in `s.notes[id]`, so they're the same everywhere the video appears. Typing doesn't re-render, so the cursor stays put.
- **Feed notes** went through several positions: above Saved → sidebar → top of the feed → **bottom, with Saved and Watch history** (final), collapsed by default. It lists every Finished and Watching now video with its notes, plus a whole-feed note, and copies as Markdown.
- **Voice typing:** a mic button on every notes box (Web Speech API).
- **Ask Claude in your notes** (final design, modelled on riddled.ai). This went through four versions: a chat box → a single question box → answers under the note → **answers written into the note**.
  - Write a line ending in `?` and press Enter, or press the orange ✱ button.
  - The question gets an underline and a pulsing dot while it "thinks". The answer is then inserted on the next line as `✱ answer`, with its words fading in, and your cursor stays where you were typing.
  - This works through a mirror layer behind a textarea with transparent text, so the styling never shifts the caret.
  - Answers are ordinary note text after that and are included in the Markdown export.
  - A hint under each video's notes explains how it works.
  - Answers are simulated from the video's title, topic and channel plus a small glossary.

### Claude bar
- **Undo and redo** (each up to 10 steps, with count badges). A new change clears redo. They cover Claude bar commands, question-card answers and the topic quick actions.

### Search
- **Google-style autocomplete:**
  - Recent searches show on focus (clock icon, × to remove, up to 8).
  - Completions come from titles, channels and topics, ranked by total views with a small penalty for long phrases, so "te" gives "tennis" first. The part you haven't typed is bold.
  - ↑/↓ previews each suggestion in the box, Esc restores your text, and ↖ fills a suggestion in without searching.
  - It's a proper ARIA combobox.

### Share
- A **Share** button on the Up next line opens a panel with the whole current set (Finished, Watching now, pinned, Up next), **each with a checkbox**, plus Select all / Clear all and a live "7 of 9 selected" count.
- It has a placeholder link with Copy, Send to `@username` (with previous blend partners as one-click suggestions), and an optional Include my notes.
- With nothing selected, Copy and Send are disabled. Nothing is actually sent.

### Shared with you (added 15 Nov)
- **A new built-in tab** (`kind:"shared"`, can't be deleted) for feeds other people sent you. It's the receiving side of Share. It shows an unread count on the tab and a "Shared with you" entry in the account menu.
- **Inbox:** each card shows who sent it, the title, video count, total time and when, their note in serif, a 4-thumbnail strip and a blue "new" dot. Click to open, × to remove. There's an empty state for when nothing has been shared.
- **Opened share:** a header with back, sender, note, the sender's own notes on specific videos, **Save as my feed** (creates a tab with those videos pinned) and remove. The feed shows the videos in the sender's order ("in @devon_r's order"), with no length or session filtering, and the settings line is hidden because the set isn't yours to tune. Watching now / Finished / notes / Ask Claude all work as normal.
- **Behaviour:** going back to the tab always shows the inbox. Reopening the same share keeps your Watching now / Finished progress. Opening a different one starts fresh, and its watching state is hidden while you're in the inbox.
- **Demo data:** three shares (`DEMO_INBOX`).

### Blend
- **Invite flow:** "Send invite" creates a pending invite that the other person has to approve in their account. The demo has Cancel invite and a dashed "Simulate their approval" button. Nothing about their taste is shown until they approve.
- **Previous blends:** a collapsible list under the Blend with a friend card. Click a row to reopen that blend, or × to remove it. The demo starts with two example blends.

### Header (15 Nov)
- The search bar moved from the centre to the top right, next to the mic, the undo button and the account icon. It's smaller (36px tall, 280px wide) and widens to 420px while focused, so autocomplete suggestions have room. The logo stays on the left.

### Colours (15 Nov)
- The warm cream palette is replaced with a neutral, YouTube-like one. Light mode: white page and app background (`--surface-0`/`--surface-2` #fff), #f2f2f2 for subtle fills (`--surface-1`), near-black text (#0f0f0f / #606060 / #757575) and YouTube blue (#065fd4) as the accent. Dark mode: #0f0f0f / #212121 / #272727 surfaces, #f1f1f1 text and #3ea6ff accent. The Claude orange stays for Claude-specific marks.
- **Only colours changed.** A bigger restyle (no outer box, borderless cards, chip tabs, round icon buttons) was tried and reverted at the user's request. It could be revisited later to make the site look less auto-generated.

### Edit/new toggle, logo refresh, undo position (15 Nov)
- **Claude mode toggle** (`#cmode`, `renderClaudeMode`, `s.claudeNew`): an icon button in the Claude bar. A pencil means **Editing <feed>** (requests change this feed). ⊕ in the accent colour means **Making a new feed** (`send()` calls `newFeed()` first). A dark tooltip appears after a 0.25s hover or on keyboard focus, giving the mode, what it does, and that clicking switches. On built-in tabs it's locked to new-feed mode (`aria-disabled`, with a tooltip explaining why), and drafts don't show it. The placeholder follows the mode. The mode is remembered when you move between your own feeds. Fix found while testing: the tooltip was drawn under the summary row, so `.cbar` now has its own raised layer (`position:relative;z-index:20`).
- **Toggle is now a switch:** at the user's request the icon button became a sliding switch (`role="switch"`, `aria-checked`). Off is a grey track with the ✏️ knob on the left (edit this feed). On is a blue track with the ⊕ knob on the right (new feed). The knob slides before the redraw so the animation shows. Built-in tabs show it locked on and dimmed. The hover tooltip is unchanged.
- **Logo = new set for this feed:** `homeAndRefresh()` no longer jumps to Everything. It adds the videos currently in Up next to a new per-feed `skip` list (filtered out in `pick()`, News included) and reshuffles. If nothing new is left, it clears `skip` and starts over. Undo restores the previous `seed` and `skip`. Tested on Everything (9 → 7 videos, none repeated) and Learn (cycled through its matches, then wrapped around).
- **Undo position:** the refresh-undo button moved to the left of the search bar. The right-hand group is right-aligned, so the button appearing or disappearing no longer shifts the search bar, mic or profile icon.

### Fewer messages (15 Nov)
- The user wanted Claude/app text only when it's really needed. 29 confirmation messages were removed: topic add/remove/hide/show, follow/unfollow, opening, reopening and finishing videos, marking watched, closing tabs, removing or saving shares, invites, approvals, reopening blends, undo/redo, "Started a new tab", thumbs feedback and others. The "How do these look?" feedback card after first topic additions is gone (undo covers it), and so is the "Welcome back…" line in Watching now (the Finished button still turns blue).
- **Kept:** errors (pop-up blocked, clipboard, microphone, tab bar full, "Connect Claude first"), no-op notices ("Already in this feed.", "Already in <folder>.", "There's nothing in this feed to save yet.", "Pick at least one video to share."), results you can't see ("Link copied.", "Notes copied.", saved-folder messages), and direct answers ("why is the top video here"). The kept ones were shortened.
- Checked in the browser pane: watch, finish, mark watched, a new tab from Home, adding a topic, undo/redo, closing a tab, invite and approve all happen silently, and the kept messages still appear. No console errors.

## Decisions worth remembering
- **Controls live where you use them.** The sidebar became a sentence of hoverable words, in line with the research showing that people ignore settings panels.
- **Quiet by default.** The app only speaks up for errors, no-ops, results you can't see, and direct answers.
- **Notes are the record.** Claude's answers go into the note text rather than a separate chat, so they're kept, editable and exported with everything else.
- **A video only moves to Finished when you say so.** Returning to the page doesn't count.
- **Honest titles also changes the thumbnails,** so clickbait loses its arrows as well as its title.
- **Only the layout choice is stored.** Everything else still resets on reload, on purpose for now.

## Known limits
- No automated tests. The prototype is one file that has grown to about 1,290 lines.
- Real voice dictation is untested: the browser pane blocks the microphone.
- Everything AI-related is simulated: the Claude bar, answers in notes, and Blend tastes. So are Share/Blend sending, thumbnails and descriptions.
- Answers sit on the line after the question, so a very long answer pushes the user's next line down. That's working as designed, but worth watching.
- On small thumbnails, the caption can be tight next to the duration badge.

## Open items and next ideas
- Possibly revisit the fuller restyle (borderless cards, chip tabs, no outer box) that was tried and reverted.
- Save notes and the rest of the state (`localStorage` first).
- Split `index.html` into modules before it grows further.
- Ideas suggested this session but not built yet ("Shared with you" from this list is now done):
  - "Why am I seeing this?" on cards
  - Temporary changes ("hide football for 3 days")
  - Muting a channel
  - Saved versions of a feed's settings
  - Timestamped notes that open YouTube at that point
  - A session timer and a "Done for today" stopping screen
  - Collaborative feeds
  - A weekly recap
  - Keyboard shortcuts and a Watch later queue you can reorder
