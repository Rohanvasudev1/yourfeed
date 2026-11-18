# 8. Share links carry the feed in the URL fragment; other people are simulated in demo mode

Date: 2026-11-18 · Status: accepted

## Context
Share, Shared with you and Blend need other people. Demo mode has no accounts, and spec #2 stays in demo mode (sign-in is spec #3). The mockup simulated all of it: links that open nothing, sends that go nowhere, a "Simulate their approval" button.

## Decision
- **Share links are real.** The shared feed (title up to 60 characters, up to 50 video ids, an optional message up to 280 characters, optional notes up to 2,000 characters in total) is compact JSON in URL-safe base64 inside the URL fragment (`/#share=…`). The fragment never reaches a server or its logs, and no storage is needed. Opening a link adds it to Shared with you once.
- An opened link is untrusted input: it is schema-checked, size-checked and must name only catalog videos, or the user sees "This share link doesn't work." Shared notes are shown as plain text.
- **Sending to a username, Blend's other person and their approval, and the From Claude connection are simulated** as in the mockup, labelled "Demo only". Shared with you starts with the mockup's demo inbox.

## Consequences
- Links carry ids from the demo catalog, so they only work against the same catalog. Signed-in sharing, real Blend and real sending wait for accounts (spec #3).
- Notes in a link are as private as the link itself; the Share panel says so when notes are included.
