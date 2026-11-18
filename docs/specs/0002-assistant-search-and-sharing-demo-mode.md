---
title: Claude bar, search and sharing in demo mode (finish porting the mockup)
labels: [ready-for-agent]
status: open
date: 2026-11-18
---

## Problem Statement

Spec #1 ported the mockup's feed experience to React, but left out everything that makes the design more than a settings panel. A visitor can't tell Claude what they want to watch, ask a question about a video in their notes, search, share a feed, open something a friend sent, blend with someone, select several tabs at once, or open the account menu. The mockup also faked all of its AI with keyword matching, so even a faithful port wouldn't show what a real assistant would do.

## Solution

Port the rest of `prototype/index.html` into the React app, still in **demo mode** (no sign-in, the demo catalog, state in the browser). The Claude bar and Ask in notes run on a real, free, open model through the backend (Groq's `gpt-oss-20b` by default, Ollama offline), with the mockup's keyword rules as the fallback, so the demo always works. Search runs over the catalog in the browser, with real voice search. Share links really work: the link carries the feed itself. Things that need other people (sending to a username, the other side of a Blend, the From Claude connection) are simulated as in the mockup and labelled "Demo only". Edit mode and the account menu finish the port. After this, the React app matches the prototype and the prototype can retire.

## User Stories

### Claude bar: requests
1. As a visitor, I want a Claude bar under the header that says "Tell Claude what you want to watch", so that I can change my feed in plain words.
2. As a visitor, I want to send a request with Enter or the send button, so that it's quick to use.
3. As a visitor, I want an empty request to say "Type something first", so that I know why nothing happened.
4. As a visitor, I want requests capped at 300 characters with a clear message, so that I know the limit.
5. As a visitor, I want the bar to show "Thinking…" and disable send while the assistant works, so that I don't send twice.
6. As a visitor, I want "add cooking" to add Cooking to the current feed, so that I can grow a feed by asking.
7. As a visitor, I want "less news" or "no wrestling" to remove or hide that topic here, so that I can trim a feed by asking.
8. As a visitor, I want "shorter videos" or "only quick ones" to set the length range, and "longer" or "deep dives" to set longer videos, so that I can change length by asking.
9. As a visitor, I want "I've got an hour" to set the session range, so that Up next fits my time.
10. As a visitor, I want "put the MCP one first" to pin that video in Up next, so that I can pick what's next by asking.
11. As a visitor, I want "why is this first?" to answer in a toast without changing anything, so that I understand the feed.
12. As a visitor, I want a request that's already true ("add AI" when AI is in the feed) to say "Already in this feed.", so that I know nothing changed.
13. As a visitor, I want requests the assistant can't do (turn on a filter, delete a tab, save a video) to get a short reply saying what it can do instead, so that I'm never left guessing.
14. As a visitor, I want every change the assistant makes to show at once in the settings line and Up next, so that I can see what it did.
15. As a visitor, I want one undo to take back everything one request did, so that undoing a request is one click.
16. As a visitor, I want the Claude bar's undo and redo to be the same as the app's undo and redo, so that there's only one history to think about.
17. As a visitor, I want the assistant to change only the feed I'm on, so that a request never surprises me somewhere else.
18. As a visitor, I want the assistant to add only topics that videos actually have, so that a request never empties my feed.

### Claude bar: edit and new mode
19. As a visitor, I want a switch on the bar between editing this feed and making a new feed, with a tooltip that says which it's doing, so that I know where my request lands.
20. As a visitor, I want the placeholder to change to "Tell Claude what to change in <feed>" in edit mode, so that the mode is obvious while I type.
21. As a visitor, I want the bar always in new mode on built-in feeds, with the switch disabled and the tooltip explaining why, so that I can't try to edit a feed that builds itself.
22. As a visitor, I want a request in new mode to create a feed named after what it added (never a built-in name, always unique), so that I get a feed in one step.
23. As a visitor, I want a new feed's draft box to say I can also tell Claude what I want, so that I know both ways work.
24. As a visitor, I want undoing a request that made a new feed to remove that feed, and redo to bring it back, so that a wrong guess costs nothing.
25. As a visitor, I want a new feed made from the bar to be shelved in All tabs when the tab bar is full, so that the 8-space limit still holds.

### Question cards
26. As a visitor, I want a broad request ("something to learn", "sport") to ask me which topics with tappable chips, so that I stay in control of vague requests.
27. As a visitor, I want a request with no matching topic to show four videos to pick from, whose topics get added, so that I can show rather than tell.
28. As a visitor, I want Add selected to need at least one pick ("Pick at least one first"), so that I don't add nothing.
29. As a visitor, I want to dismiss a question card, so that I can ignore it.
30. As a visitor, I want a feedback card with thumbs up and down after the first topics land in a near-empty feed, so that a bad first guess is easy to take back.
31. As a visitor, I want question cards to close when I change tabs or send another request, so that old questions don't linger.

### Ask in notes
32. As a visitor, I want a line in a video's notes ending in `?` to be answered on the next line starting with ✱ when I press Enter, so that I can ask about a video while I watch.
33. As a visitor, I want a ✱ button on the notes box that answers my last unanswered question, so that I can ask without the keyboard.
34. As a visitor, I want a dot by a question while it's being answered and the answer inked in word by word, so that I can see it working.
35. As a visitor, I want answers to keep my cursor and focus where they were, so that I can keep typing.
36. As a visitor, I want answers to say what they can't know (what's said at a minute, who's on screen), so that I'm not misled.
37. As a visitor, I want a hint under the notes box ("End a line with ? and press Enter") and clear messages ("Your questions are already answered…", "Keep questions under 300 characters"), so that I know how it works.
38. As a visitor, I want the same question not to be asked twice while it's waiting, so that I don't get duplicate answers.
39. As a visitor, I want an answer not to be inserted if I deleted the question meanwhile, so that my notes never get a stray answer.

### Assistant behind the scenes
40. As a visitor, I want the app to keep working with simple keyword rules when no AI is set up, the AI fails, takes too long or is busy, so that the demo never breaks.
41. As a visitor, I want one quiet line when simple rules are answering because of a limit ("Using simple rules for now. AI is busy."), so that I know why answers got simpler.
42. As a visitor, I want to be told, before my first request and in the account menu, that requests and note questions go to the named provider and not to include anything private, so that I know where my words go.
43. As a visitor, I want nothing sent to the AI until I press send or ask a question, so that my notes stay mine.
44. As someone running the hosted demo, I want per-visitor and site-wide daily limits on AI calls, so that the free quota lasts and one visitor can't use it up.
45. As someone self-hosting, I want to point the backend at Groq, Ollama or any OpenAI-compatible API with three environment variables, so that I can use whatever free model I have.
46. As someone self-hosting, I want the AI key to stay on the server, so that it never leaks to the browser.

### From Claude
47. As a visitor, I want From Claude in the Explore menu, so that I can find it.
48. As a visitor, I want From Claude to start with a Connect Claude step that explains only a short summary of recent work is shared, so that I know what connecting means.
49. As a visitor, I want connecting to fill the feed with topics from that summary (demo: a fixed summary, labelled as demo), so that I see what it would do.
50. As a visitor, I want the connected feed to list the recent work and its topics, with suggestion chips ("More MCP tutorials", "Something to learn tonight", "Surprise me") that send a request, so that adding to it is one tap.
51. As a visitor, I want to disconnect, which clears its topics, so that I can undo connecting.
52. As a visitor, I want requests on From Claude before connecting to say "Connect Claude first, then tell me what to add.", so that I know the next step.

### Search
53. As a visitor, I want a search box in the header, so that I can find any video in the catalog.
54. As a visitor, I want suggestions as I type, from titles, channels and topics ranked by popularity, with the part I haven't typed in bold, so that searching feels like YouTube.
55. As a visitor, I want my recent searches first in the suggestions, each removable, so that I can repeat a search quickly.
56. As a visitor, I want arrow keys to move through suggestions (filling the box), Enter to search, Esc to close them, and a fill-in arrow to complete without searching, so that search works from the keyboard.
57. As a visitor, I want a search page with "<n> results for <query>", a back button, and "Adding to: <feed>", so that I know where pins go.
58. As a visitor, I want results to match title, honest title, channel or topic, and to respect Hide clickbait and Honest titles, so that search follows my filters.
59. As a visitor, I want + on a result to pin it to the current feed, and playing a result to work as in the feed, so that I can use what I find.
60. As a visitor, I want "No videos match that search. Try a channel name or topic." when nothing matches, so that I know what to try.
61. As a visitor, I want a mic button that fills the search box from my voice where the browser supports it, with clear messages when it's blocked or unsupported, so that I can search hands-free.
62. As a visitor, I want switching tabs to leave the search page, so that the header behaves predictably.

### Share
63. As a visitor, I want a Share button on a feed that opens a Share panel with every session video selected, so that sharing starts with one click.
64. As a visitor, I want to untick videos, with Select all / Clear all and a "<n> of <m> selected" count, so that I send only what I mean to.
65. As a visitor, I want "Pick at least one video to share." when nothing is selected, with Copy and Send disabled, so that I can't send an empty share.
66. As a visitor, I want a share link I can copy ("Link copied."), with a fallback message when copying isn't allowed, so that I can paste it anywhere.
67. As a visitor, I want the link to really open the shared feed for whoever has it, with no account, so that sharing works in the demo.
68. As a visitor, I want to include my notes (and see how many videos have notes), knowing anyone with the link can read them, so that I choose what to share.
69. As a visitor, I want to send to a username, with checks ("Type a username first", "Usernames are 3–20 letters, numbers, dots or underscores", "Already sent to @x") and "Sent to @x" afterwards, so that sending feels real (demo: nothing is sent, and the panel says so).
70. As a visitor, I want quick-send chips for people I've blended with, so that sending to friends is one tap.

### Shared with you
71. As a visitor, I want a Shared with you feed in Explore with an unread count, so that I notice new shares.
72. As a visitor, I want an inbox of shared feeds, each with who sent it, title, video count, total time, age, their message, a strip of thumbnails and "includes their notes", so that I can choose what to open.
73. As a visitor, I want unread shares marked with a dot until I open them, so that I know what's new.
74. As a visitor, I want to open a shared feed and watch it like any feed (Watching now, Finished, notes), with a back button to the inbox, so that a share is easy to use.
75. As a visitor, I want the sender's notes shown above the videos, so that I get their tips.
76. As a visitor, I want Save as my feed to make it one of my feeds ("<title> from @<name>"), so that I can keep it.
77. As a visitor, I want to remove a share from the inbox, so that it stays tidy.
78. As a visitor, I want opening a share link to add it to the inbox once and open it, and a broken link to say "This share link doesn't work.", so that links are safe to click.
79. As a visitor, I want "Nothing shared with you yet" when the inbox is empty, so that the page isn't blank.
80. As a visitor, I want the demo inbox to start with the mockup's three example shares, so that the feature shows off without a friend.

### Blend
81. As a visitor, I want a Blend feed in Explore that asks for a friend's username and sends an invite, with the same username checks as Share, so that I can mix our tastes.
82. As a visitor, I want a pending state ("Invite sent to @x") with Cancel invite and, in the demo, Simulate their approval, so that I can see the whole flow alone.
83. As a visitor, I want an approved blend to show both avatars, "You + @x", a match score and a mix of shared topics first, then mine, then theirs, so that the feed is clearly ours.
84. As a visitor, I want to change who I blend with, so that I can try someone else.
85. As a visitor, I want the demo to start with two example blends (used for quick-send in Share), so that the feature shows off without a friend.

### Edit mode
86. As a visitor, I want an Edit button that lets me select several tabs (in the bar and All tabs) with a check on each, so that I can tidy up in bulk.
87. As a visitor, I want "<n> selected" and buttons to Move to All tabs, Show in tab bar (on All tabs) and Delete, so that I can act on all of them at once.
88. As a visitor, I want bulk delete to confirm ("Delete <n> tabs? This can't be undone."), refuse built-in feeds by name, and keep at least one feed, so that I can't break the app.
89. As a visitor, I want Show in tab bar to refuse when it would pass 8 spaces, so that the limit still holds.
90. As a visitor, I want "Select at least one tab first." when nothing is selected, so that I know why nothing happened.

### Account menu
91. As a visitor, I want an avatar button that opens an account menu ("You · @you · demo account"), so that I know I'm in demo mode.
92. As a visitor, I want the menu to jump to All your feeds, Saved, Watch history, Feed notes, Shared with you, Blends and From Claude, with counts, so that everything is one click away.
93. As a visitor, I want the menu to say which assistant is answering ("Answers by gpt-oss-20b via Groq" or "Answers by simple rules") and where requests go, so that the Claude wording is honest.
94. As a visitor, I want the menu to say "Signing in isn't part of the demo.", so that I don't look for it.

### Throughout
95. As a keyboard or screen-reader user, I want the Claude bar, mode switch, question cards, search combobox, Share panel, inbox, Blend and edit mode to be reachable and named, so that the new parts work without a mouse.
96. As a visitor, I want the new parts to stay quiet except for errors, no-ops, results I can't see and direct answers (spec #1 story 67), so that the app still never nags.
97. As a visitor, I want inbox, blends, recent searches, the From Claude connection and bar mode saved in my browser like everything else, so that a reload changes nothing.

## Implementation Decisions

- **Respects ADRs 0001–0008.** Demo mode only. Composition stays in the frontend (0003). AI goes through the backend with any OpenAI-compatible provider (0004), Groq `gpt-oss-20b` by default, Ollama `qwen3:4b` offline, keyword rules last (0006). The assistant changes only the current feed through checked feed actions, with one undo history (0007). Share links carry the feed in the URL fragment; other people are simulated (0008).
- **Backend: one `Assistant` interface, three versions.** `handle(request, context) -> AssistantResult` and `answer(question, video) -> text`. Versions: the OpenAI-compatible model (tool calling for feed actions; a 15-second timeout), the keyword rules (ported from the mockup's `agent`, `addFlow`, `BROAD` and `answerFor` glossary), and a scripted fake for tests. A small selector picks the model when configured and falls back to the rules on no config, provider error, timeout or a limit.
- **API contract** (in the existing response envelope):
  - `POST /api/assistant/request`: body is the request text (≤ 300 characters), bar mode, and context: the current feed's kind, name, topics, channels, mutes, length and session ranges, and its top 20 Up next videos (id, title, topic, channel). Returns `{ actions: FeedAction[], reply?: string, answeredBy: "model" | "rules", notice?: string }`.
  - `POST /api/assistant/answer`: body is a video id and the question (≤ 300 characters). The backend looks the video up in the catalog itself. Returns `{ answer, answeredBy }`.
  - `GET /api/assistant/info`: which assistant is configured (provider and model name, or rules) for the account menu and the provider notice. No secrets.
- **Feed actions** (discriminated union, validated with a schema on both sides): `set_topics {add, remove}`, `mute_topic {topic}`, `set_length_range {min, max}`, `set_session_range {min, max}`, `pin_video {id}`, `ask_user {kind: chips|videos|feedback, question, items}`, `create_feed {name?}`. Topics must be in the catalog's topic list; `pin_video` and video items must be in the context's ids; ranges are clamped as by hand. Invalid actions are dropped and logged on the server.
- **AI limits** are in-memory on the backend, configured by environment: per IP about 10 a minute and 100 a day, a site-wide daily cap; over a limit the rules answer and `notice` carries the quiet line. The model prompt says to answer notes in at most two sentences and to say what it can't know.
- **Frontend: a third injected port**, the assistant: `request(text, mode, context) => Promise<AssistantResult>`, `answer(videoId, question) => Promise<AnswerResult>`, `info() => Promise<AssistantInfo>`. Production uses the API client; tests pass a scripted fake. The app depends only on this interface, like the catalog loader and state storage.
- **Applying a request** is one reducer action carrying all its feed actions, so it records exactly one undo step. In new mode the reducer first creates the feed (a draft named from what was added, using the existing unique-name and built-in-name rules, shelved if the bar is full). The undo step records the created feed so undo removes it and redo restores it.
- **Question cards** are state in the app (`ask`), shown above the feed. Committing chips or videos applies `set_topics` through the same one-step path. The feedback card appears after a request adds the first topics to a feed that had fewer than two (not on Everything); thumbs down removes those topics as its own undo step.
- **Ask in notes** extends the existing notes component: a mirror layer highlights question lines and inks answers; answers are inserted after their question line, keeping the selection; pending answers are tracked per video so a question isn't asked twice and an answer whose question is gone is dropped.
- **Search** is pure functions in the domain layer: `searchCatalog(catalog, query, filters)` and `suggestFor(corpus, recent, typed)` ported from the mockup (weight = summed views, topics doubled, recent searches first, at most the mockup's suggestion and recent counts). Voice search reuses the existing voice-typing hook.
- **Share links**: a pure codec module `encodeShare` / `decodeShare` (zod schema, size limits from ADR 0008, URL-safe base64 JSON in `#share=`). On load and on `hashchange`, the app decodes the fragment, checks every id against the catalog, adds the share to the inbox once (keyed by a hash of its contents), opens it, and clears the fragment.
- **New feed kinds** `claude`, `blend` and `shared` join the Explore menu and the demo seed, with their per-kind state: From Claude's `connected`, a Blend's `partner {name, topics, score, status}`, Shared with you's `open` share. App state gains `inbox`, `blends`, `recentSearches` and `barMode`. All are persisted and validated on load like existing state, under a bumped storage version that falls back to the seed.
- **Simulated people**: a username's taste is derived from a hash of the name (as the mockup's `tasteOf`), the match score from overlap with my topics; Simulate their approval moves pending to accepted. The demo inbox and blends are the mockup's `DEMO_INBOX` and `DEMO_BLENDS`, re-keyed to `demo-N` ids. The From Claude summary is the mockup's `CLAUDE_WORK`.
- **Edit mode** is page state (`editing`, `selected`), shared by the tab bar and All tabs; bulk actions reuse the existing shelve, show and delete rules.
- **Account menu** uses the existing popup controller.
- **Files stay small**: one component per area (Claude bar, mode switch, question card, search box, search page, Share panel, inbox, shared feed header, Blend panel, From Claude panel, edit bar, account menu), each under about 400 lines. Backend: one module each for the assistant interface, the model provider, the rules, limits, and the router.

## Testing Decisions

- **Good tests check behaviour a visitor (or an API client) can see** and never reach into components, the reducer, prompts or the rules' internals.
- **Seam 1 (existing, main): the whole app**, rendered with Testing Library on Vitest with an injected catalog, in-memory storage and, new, a scripted assistant port. Each story group gets tests here: a scripted request changes the settings line and one undo takes it all back; new mode creates a feed and undo removes it; question cards; Ask in notes keeps focus and inserts the answer; search and suggestions with the keyboard; Share panel selection and copy (clipboard stubbed); opening a `#share=` fragment fills the inbox, and a broken one shows the message; Blend through simulated approval; edit mode bulk actions; account menu counts and assistant name.
- **Seam 2 (existing): pure domain functions.** `composeFeed`'s tests are the prior art. New ones: search and suggestions, the share codec (round trip, size limits, bad input), blend topics and match score.
- **Seam 3 (new): the backend assistant API**, through FastAPI's test client with the scripted fake selected or the rules, never a real model. Tests: the request and answer endpoints' contracts, invalid actions dropped, limits per visitor and site-wide switching to rules with a notice, provider error and timeout falling back to rules, length limits rejected, `info` exposing no secrets. The rules get table tests ported from the mockup's keyword behaviour (add, broad question, videos question, less, short, longer, why). The existing catalog API tests are the prior art.
- **Seam 4 (existing): Playwright smoke**, extended by one flow against the real backend with no AI key (rules): send "add cooking" and see Cooking in the settings line, then undo.
- **Optional eval script** runs a fixed set of requests against a configured real model and reports which produced the expected actions. Not in CI; for comparing models.
- **Coverage** stays at 80%+ on the frontend; the backend assistant modules get the same target through seam 3.

## Out of Scope

- Google sign-in, the YouTube catalog, saving state on the server, real Blend between two accounts, real sending to a username and a real Claude connection. All are spec #3 (ADR 0005).
- A showcase frontend at the level of awwwards.com sites. Spec #3.
- Pasting your own work summary into From Claude to have the model pull topics out of it.
- Streaming answers, chat history or a conversation with the assistant.
- The assistant changing global filters, tabs, saved folders or other feeds.
- Answering from transcripts or the playback time (ADR 0005 bans transcript scraping).
- Server-side search or search over YouTube.
- Paid models or any setup that needs credits.

## Further Notes

- `prototype/index.html` stays the reference for look and behaviour. When this spec and the prototype disagree, this spec wins. Where this spec is silent, match the prototype. Known deliberate differences: one undo history instead of the bar's own, share links that work, real voice search, no "save" rule, and the model's name shown in the account menu.
- Once this lands the React app covers the whole prototype: update the README (AI setup for Groq and Ollama, `.env.example` with `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` and the limit variables) and mark the prototype as retired in its notes.
- The owner's machine has 8 GB of RAM, which is why the offline model is `qwen3:4b` and not a 20B model.
