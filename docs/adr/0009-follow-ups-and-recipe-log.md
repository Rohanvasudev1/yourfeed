# 9. Follow-ups through a per-feed recipe log, not a chat

Date: 2026-11-23 · Status: accepted (amends [ADR 0007](0007-assistant-changes-only-the-current-feed.md))

## Context
People phrase requests as follow-ups ("more like that", "no, shorter"), which a stateless Claude bar can't follow. A full conversation panel would break ADR 0007's one undo step per request (what does undoing turn 4 of 7 mean?), blow Groq's free budget (8,000 tokens a minute, about 1,300 per request today) and make text, not the feed, the answer.

## Decision
- Each feed keeps a **recipe log**: one line per request, recording the request, what it changed ("added Cooking · 10–30 min") and any reply in short form. Question-card answers are logged too. At most 20 lines per feed, saved with the feed.
- A request carries the last 3 **live** lines of the current feed's log as **follow-up** context (about 60 tokens each). To stay near 1,500 tokens, the Up next context drops from 20 videos to 15.
- Undo greys out the request's line; redo restores it. Greyed lines are never sent. "Clear log" empties it. Switching tabs switches logs.
- Each request is still exactly one undo step and still changes only the current feed (ADR 0007 unchanged otherwise).
- The keyword rules ignore the log.

## Consequences
- The conversation is with the feed's recipe, and its history is a readable change log of that recipe, not a transcript.
- "Chat" stays on the Avoid list in `CONTEXT.md`.
