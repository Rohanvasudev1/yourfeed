# 7. The assistant changes only the current feed, through checked feed actions

Date: 2026-11-18 · Status: accepted

## Context
The Claude bar turns plain language into changes. A model can misread a request or invent things (a topic no video has, a video id that doesn't exist). The mockup also gave the Claude bar its own undo history next to the hand-change undo, which leaves the user guessing which undo undoes what.

## Decision
- The assistant acts only on the **current feed**, and only through feed actions: `set_topics`, `mute_topic`, `set_length_range`, `set_session_range`, `pin_video`, `ask_user` (question cards) and `create_feed` (new mode), plus a text **reply** that changes nothing. It never touches global filters, tabs, saved folders or other feeds. The mockup's "save" rule is dropped.
- The frontend sends the request with the current feed's kind and settings and its top 20 Up next videos (id, title, topic, channel). The backend adds the catalog's topic list. Tool schemas limit topics to that list and `pin_video` to the ids sent; the backend checks every action again and drops any that fail, ranges are clamped as by hand.
- **One undo history.** Each request adds one undo step however many actions it ran, and the Claude bar's undo/redo use the same stack as everything else. Undoing a request that ran `create_feed` removes that feed and redo restores it; this is the one time a tab is undone.
- No streaming: the bar shows "Thinking…" and disables send until the answer arrives.

## Consequences
- Requests like "turn on Honest titles" get a reply pointing to the filters instead of acting. Widening the action set later means a new action, a schema and a check, not a prompt change.
