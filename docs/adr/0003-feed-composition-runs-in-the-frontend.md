# 3. Feed composition runs in the frontend; the backend owns data

Date: 2026-11-15 · Status: accepted

## Context
Changing a feed setting should take effect immediately (the research says controls that seem to do nothing feel like placebos). Demo mode keeps its state in the browser.

## Decision
- The backend serves a user's **catalog** (demo or YouTube), state persistence for signed-in users, OAuth, and AI calls.
- `composeFeed` (catalog + feed + global filters → Up next) is a pure TypeScript function in the frontend. Sliders and toggles re-run it locally, with no network round trip.

## Consequences
- A catalog has to stay small enough to send whole: a few hundred to a few thousand videos per user. If that stops being true, move composition to the backend behind the same interface.
- AI tagging (topic, clickbait, honest title) runs on the backend once per video and is stored there, so composition only filters data that's already tagged.
