# 10. The recommender ranks only your catalog, and behaviour proposes changes instead of making them

Date: 2026-11-23 · Status: accepted

## Context
YouTube-scale learning isn't possible here: the API exposes no watch history and Yourfeed has few users (research/background.md §4–5 in the feed-lab worktree). What Yourfeed has that YouTube doesn't is an explicit, persistent statement of preference: the feed's recipe. Folding behaviour silently into the ranking would erase that difference and invite preference drift.

## Decision
- A **Ranker** interface in the frontend (catalog + feed + behaviour → scored videos with a reason each) replaces `homeScore`. Composition stays pure and in the frontend (ADR 0003 stands).
- Signals: the recipe, Yourfeed's own behaviour (Finished, removed, skipped, pinned, watched, notes), recency and channel. **Views are never a ranking input** outside Most viewed. `log10(views)` leaves Everything.
- Every card can say why it is there (the reason the Ranker returned).
- **Recipe mirror**: a pure function over the last 14 days of behaviour on a feed. When at least 3 signals disagree with the recipe (Finished outside the length range, a topic repeatedly removed, pins from a muted topic…), it proposes the change as feed actions on a card. At most one proposal per feed per visit; accept applies it as one undo step; dismiss hides that proposal for 7 days. No model involved.
- **Outside your recipe**: one labelled video per session from topics adjacent to the feed's (subscriptions first, then cached topic searches), turned off per feed.
- The feed lab (`research/`) stays a separate track; a lab model can later implement `Ranker`.

## Consequences
- The recipe is a contract: the system proposes, the user decides, and nothing changes the recipe without an undoable action.
- Behaviour data is Yourfeed's own, not YouTube API Data, so the derived-data clause (III.E.4.h) doesn't touch the mirror or the Ranker's behaviour terms.
