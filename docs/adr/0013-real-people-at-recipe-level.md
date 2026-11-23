# 13. Other people, for real, at the recipe level

Date: 2026-11-23 · Status: accepted (supersedes the simulated parts of [ADR 0008](0008-share-links-carry-the-feed.md) in signed-in mode)

## Decision
- **Share links** keep carrying the feed in the URL fragment. Signed in, unknown ids are looked up with `videos.list`, so links work across catalogs; demo mode keeps checking against the demo catalog.
- **Sending to a username** and **Blend** are real between signed-in accounts. Usernames are chosen at first sign-in. A Blend mixes the two people's *recipes* (topics), each applied to its own catalog; one user's subscription-derived catalog is never shown to another (III.E.3.b).
- **From Claude** stays simulated in both modes: there's no API for a Claude work summary.
- Demo mode keeps ADR 0008's simulations unchanged.
